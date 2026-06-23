# Beacon — System Implementation Technical Specification

> A reference for the *System Implementation* chapter of the thesis. It documents
> what was actually built: the architecture, data model, security mechanisms,
> request flows, and the key source code. Code snippets are taken verbatim from
> the implementation.

---

## 1. Overview

**Beacon** is a Digital Health Passport and Emergency Medical Identification
system. A **patient** records critical medical information (blood group,
allergies, medications, conditions, emergency contacts, and more), which is
stored with sensitive fields encrypted at rest. The patient receives a QR code
that encodes only an opaque token. In an emergency, an authenticated and
administratively **approved healthcare provider** scans the code and is shown a
restricted, glanceable *triage view* of the patient's data. Every access is
recorded in an append-only audit log, the patient can see who viewed their
record, can be notified by email on access, and can pause access entirely.

The system embodies one product with two opposing modes:

- **Patient mode** — calm, spacious self-service for managing one's own record.
- **Emergency mode** — a stark, official "Emergency Medical ID" optimised for a
  responder reading on a phone, under pressure, in seconds.

### 1.1 Scope

In scope: patient self-service CRUD, field encryption, QR generation and
revocation, the privileged emergency-access path, provider approval workflow,
audit logging with accessor identity, access notifications, a patient access
kill switch, and role-based authorization. Out of scope (prototype boundaries):
national/hospital database integration, telemedicine, real-time monitoring,
insurance/payments, and biometric capture.

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Framework | **Next.js 16** (App Router, React 19, Turbopack) | Unified server + client rendering; React Server Components allow sensitive logic to stay on the server. |
| Language | **TypeScript** (strict mode) | Compile-time safety across the data and auth layers. |
| Styling | **Tailwind CSS v4** (`@theme`) + custom component library | Token-driven, accessible design system. |
| Display type | **Fraunces** (display), **Geist Sans** (body), **Geist Mono** (vitals) | Editorial identity; monospaced tabular figures for clinical data. |
| Authentication & Database | **Supabase** — Postgres, Supabase Auth, `@supabase/supabase-js`, `@supabase/ssr` | Managed Postgres with Row Level Security as the authorization core; bcrypt password hashing handled by Supabase Auth. |
| Authorization | **PostgreSQL Row Level Security (RLS)** | Authorization enforced at the data tier, not (only) in application code. |
| Encryption | **Web Crypto API**, AES-256-GCM | Authenticated field-level encryption for sensitive columns. |
| QR generation | **`qrcode`** (server-side) | Encodes a URL containing only the token. |
| Email (optional) | **Resend** HTTP API | Access notifications; pluggable seam. |
| Hosting | **Render / Vercel** (app) + **Supabase** (DB/Auth) | All traffic over HTTPS/TLS. |

---

## 3. System Architecture

Beacon is a three-tier system. The application tier deliberately contains a
single *privileged* path that is allowed to cross the data-ownership boundary;
everything else for the patient runs under Row Level Security.

```
 Presentation                Application / Logic                 Data
 ─────────────               ───────────────────                 ────
 Next.js 16 (App Router) ┌─► Supabase Auth (sessions, cookies) ┌► Postgres (Supabase)
 React Server Components │   proxy.ts (session refresh, guard) │   • profiles
 Client Components       │   Server Actions (patient writes)   │   • medical_profiles
 (forms, toggles)        │   Route Handler /api/emergency      │   • access_logs
                         │   Privileged read (secret key) ─────┘   + RLS policies
                         └─► Postgres RLS (authz at data tier)     + handle_new_user trigger
```

Two distinct database access identities are used:

1. **User-scoped client** — created per request with the **publishable key** and
   the signed-in user's cookies. All queries pass through RLS, so a user can
   only ever read or write their own rows.
2. **Privileged client** — created with the **secret key**, used *only* by the
   emergency-access path and the admin approval action. It bypasses RLS to
   perform the cross-owner read, decrypt fields, write the audit log, and read
   the admin queue. It is guarded by `import "server-only"`.

---

## 4. Data Model

Authentication identities live in Supabase's managed `auth.users` table.
Application data lives in three tables in the `public` schema.

### 4.1 Schema, indexes, and trigger (`supabase/migrations/0001_init.sql`)

```sql
create type public.user_role as enum ('patient', 'provider');
create type public.provider_status as enum ('none', 'pending', 'approved');

-- profiles (1:1 with auth.users)
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  role            public.user_role not null default 'patient',
  provider_status public.provider_status not null default 'none',
  full_name       text,
  created_at      timestamptz not null default now()
);

-- medical_profiles (1:1 with a patient profile)
create table public.medical_profiles (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references public.profiles (id) on delete cascade,
  blood_group              text not null default 'unknown'
                             check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown')),
  allergies                text,           -- AES-256-GCM encrypted
  medications              text,           -- AES-256-GCM encrypted
  medical_conditions       text,           -- AES-256-GCM encrypted
  emergency_contact_name   text,
  emergency_contact_phone  text,
  qr_token                 uuid not null unique default gen_random_uuid(),
  updated_at               timestamptz not null default now()
);

create index medical_profiles_user_id_idx  on public.medical_profiles (user_id);
create index medical_profiles_qr_token_idx on public.medical_profiles (qr_token);

-- access_logs (append-only audit trail)
create table public.access_logs (
  id          uuid primary key default gen_random_uuid(),
  accessor_id uuid not null references public.profiles (id) on delete cascade,
  patient_id  uuid not null references public.medical_profiles (id) on delete cascade,
  access_type text not null default 'emergency_view',
  created_at  timestamptz not null default now()
);

create index access_logs_patient_id_idx on public.access_logs (patient_id);
```

A database trigger provisions a `profiles` row automatically whenever a new
auth user is created, carrying the role from signup metadata. Provider
self-registrations land in `provider_status = 'pending'`:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role public.user_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::public.user_role, 'patient'
  );
begin
  insert into public.profiles (id, role, provider_status, full_name)
  values (
    new.id,
    meta_role,
    case when meta_role = 'provider' then 'pending'::public.provider_status
         else 'none'::public.provider_status end,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### 4.2 Schema extension (`0002_extend.sql`)

A second migration adds accountability and richer clinical data:

```sql
-- access_logs: capture WHO accessed (denormalised; see §10.3)
alter table public.access_logs
  add column if not exists accessor_name  text,
  add column if not exists accessor_email text;

-- medical_profiles: patient kill switch + expanded triage data
alter table public.medical_profiles
  add column if not exists emergency_access_enabled boolean not null default true,
  add column if not exists date_of_birth date,
  add column if not exists sex text,
  add column if not exists organ_donor boolean,
  add column if not exists additional_notes text,            -- AES-encrypted
  add column if not exists emergency_contact_relationship text,
  add column if not exists emergency_contact_2_name text,
  add column if not exists emergency_contact_2_phone text,
  add column if not exists emergency_contact_2_relationship text,
  add column if not exists primary_physician_name text,
  add column if not exists primary_physician_phone text;

alter table public.medical_profiles
  add constraint medical_profiles_sex_check
  check (sex is null or sex in ('female','male','intersex','prefer_not_to_say','unknown'));
```

Encrypted columns are intentionally **not queryable** — the whole profile is
always fetched by `user_id` or `qr_token`, so this is not a limitation in
practice.

---

## 5. Authorization — Row Level Security (the core)

Authorization is enforced at the **data tier** with PostgreSQL Row Level
Security. RLS is enabled on every table, and policies restrict each user to
their own data. Crucially, there is **no provider read policy** on
`medical_profiles` — providers cannot read patient data through the ordinary
client at all. The only cross-owner read is the privileged server path (§10),
which is centralised and auditable.

```sql
alter table public.profiles         enable row level security;
alter table public.medical_profiles enable row level security;
alter table public.access_logs      enable row level security;

-- profiles: a user may read/update only their own row.
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- medical_profiles: a patient has full CRUD over only their own record.
-- (No provider SELECT policy — that is intentional.)
create policy "medical_profiles_select_own" on public.medical_profiles
  for select using (user_id = auth.uid());
create policy "medical_profiles_insert_own" on public.medical_profiles
  for insert with check (user_id = auth.uid());
create policy "medical_profiles_update_own" on public.medical_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "medical_profiles_delete_own" on public.medical_profiles
  for delete using (user_id = auth.uid());

-- access_logs: a patient may read their own access events.
-- No client INSERT policy — logs are written only by the secret-key path.
create policy "access_logs_select_own" on public.access_logs
  for select using (
    patient_id in (select id from public.medical_profiles where user_id = auth.uid())
  );
```

This design means that even a bug in the application layer cannot leak one
patient's data to another patient, because the database itself refuses the
query.

---

## 6. Authentication and Session Management

Beacon uses Supabase Auth (email + password; passwords are bcrypt-hashed by
Supabase and never stored in plaintext). Sessions are carried in **HTTP-only
cookies** using the PKCE flow via `@supabase/ssr`. Three client factories are
defined.

### 6.1 Browser client (`src/lib/supabase/client.ts`)

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

### 6.2 Server client (`src/lib/supabase/server.ts`)

The server client is constructed **inside each request handler** (never at
module scope, to avoid session leakage on reused serverless instances) and is
wired to Next's cookie store:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch {
            // Read-only context (Server Component); proxy refreshes the session.
          }
        },
      },
    },
  );
}
```

### 6.3 Privileged client (`src/lib/supabase/admin.ts`)

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

The `import "server-only"` directive makes the build fail if this module is ever
imported into client code, preventing accidental exposure of the secret key.

### 6.4 Edge proxy (`src/proxy.ts`)

A root **proxy** (the Next.js 16 successor to the deprecated *middleware*
convention) runs before every matched request. It refreshes the session, syncs
cookies, verifies the user with `getUser()` (rather than trusting the cookie
blindly), and redirects unauthenticated requests away from protected routes.
The `getUser()` call is wrapped so that a transient network failure degrades
gracefully instead of returning HTTP 500 for the whole application.

```ts
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    },
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  const { pathname, search } = request.nextUrl;
  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith("/e/") ? "/provider/login" : "/login";
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)"],
};
```

### 6.5 Profile resolution and self-healing (`src/lib/auth.ts`)

Server code resolves the current user and their profile via `getCurrentProfile`.
If an authenticated user has no `profiles` row (e.g. the account predates the
trigger), the function provisions one on read — made possible by the
`profiles_insert_own` RLS policy:

```ts
export async function getCurrentProfile(): Promise<
  { user: User; profile: ProfileRow } | null
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (existing) return { user, profile: existing as ProfileRow };

  const meta = user.user_metadata ?? {};
  const role = meta.role === "provider" ? "provider" : "patient";
  const { data: created } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      role,
      provider_status: role === "provider" ? "pending" : "none",
      full_name: (meta.full_name as string | undefined) ?? null,
    }, { onConflict: "id" })
    .select("*").maybeSingle();

  return created ? { user, profile: created as ProfileRow } : null;
}

export function isApprovedProvider(profile: ProfileRow | null | undefined): boolean {
  return profile?.role === "provider" && profile.provider_status === "approved";
}
```

---

## 7. Field-Level Encryption

The three free-text clinical fields (`allergies`, `medications`,
`medical_conditions`) plus `additional_notes` are encrypted with **AES-256-GCM**
via the Web Crypto API before storage, and decrypted only inside privileged
server code. The 256-bit key lives in the `BEACON_ENCRYPTION_KEY` environment
variable, separate from database credentials, and never reaches the browser.

GCM is an *authenticated* cipher: each value is stored as
`base64(iv):base64(ciphertext+tag)`. The 96-bit IV is randomly generated per
encryption, and decryption fails (throws) if the authentication tag does not
verify — giving tamper detection for free. A database dump therefore leaks
nothing readable without the separate key.

```ts
// src/lib/crypto.ts (excerpt)
const IV_BYTES = 12;          // 96-bit nonce, recommended for GCM
const ALGO = "AES-GCM";

export async function encryptField(plaintext: string | null | undefined): Promise<string | null> {
  if (plaintext == null || plaintext === "") return null;
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt({ name: ALGO, iv }, key, strBytes(plaintext));
  return `${toB64(iv)}:${toB64(ct)}`;
}

export async function decryptField(packed: string | null | undefined): Promise<string> {
  if (packed == null || packed === "") return "";
  const [ivB64, ctB64] = packed.split(":");
  if (!ivB64 || !ctB64) throw new Error("Malformed ciphertext: expected iv:ciphertext");
  const key = await getKey();
  // Throws OperationError if the auth tag fails — tamper detection.
  const plain = await crypto.subtle.decrypt({ name: ALGO, iv: toBytes(ivB64) }, key, toBytes(ctB64));
  return new TextDecoder().decode(plain);
}
```

The key is imported once and cached, and the module asserts it is never executed
in a browser:

```ts
function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error("crypto.ts must never run in the browser");
  }
}
```

---

## 8. Patient Self-Service (Encrypt-on-Write)

Because the encryption key must never reach the client, the patient's medical
profile form posts to a **Server Action**. The action validates input with Zod,
encrypts the sensitive fields server-side, and writes the row through the
**user's RLS-scoped session** — so ownership is still enforced at the data tier
even though encryption happens in privileged code.

```ts
// src/app/(patient)/profile/edit/actions.ts (excerpt)
"use server";

export async function saveMedicalProfile(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const parsed = medicalProfileSchema.safeParse({ /* …all fields from formData… */ });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  const v = parsed.data;

  const [allergies, medications, medical_conditions, additional_notes] = await Promise.all([
    encryptField(v.allergies),
    encryptField(v.medications),
    encryptField(v.medical_conditions),
    encryptField(v.additional_notes),
  ]);

  const organDonor = v.organ_donor === "yes" ? true : v.organ_donor === "no" ? false : null;

  const { error } = await supabase.from("medical_profiles").upsert({
    user_id: user.id,
    blood_group: v.blood_group,
    date_of_birth: v.date_of_birth || null,
    sex: v.sex || null,
    organ_donor: organDonor,
    allergies, medications, medical_conditions, additional_notes,
    /* …contacts, physician… */
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (error) return { error: "We couldn't save your profile. Please try again." };
  revalidatePath("/dashboard");
  redirect("/dashboard?saved=1");
}
```

Reading the profile back for editing decrypts server-side via
`getOwnMedicalProfileDecrypted()` in `src/lib/medical.ts`.

---

## 9. QR Code Generation and Revocation

Each `medical_profiles` row owns a unique `qr_token` (UUID v4). The QR encodes
only a URL containing that token — never any personal data:

```ts
// src/lib/qr.ts
export function emergencyUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  return `${base}/e/${token}`;
}

export async function qrDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(emergencyUrl(token), {
    errorCorrectionLevel: "M", margin: 2, width: 512,
    color: { dark: "#134E4A", light: "#FFFFFF" },
  });
}
```

Revocation is instantaneous: regenerating the token overwrites `qr_token`, so any
previously printed code stops resolving. This is a patient-invoked Server Action:

```ts
export async function regenerateQrToken(): Promise<RegenerateState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const { error } = await supabase.from("medical_profiles")
    .update({ qr_token: crypto.randomUUID(), updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) return { error: "We couldn't regenerate your code. Try again." };
  revalidatePath("/qr");
  revalidatePath("/dashboard");
  return { ok: true };
}
```

---

## 10. The Emergency Access Path (signature flow)

This is the one path that crosses the data-ownership boundary. It is centralised
in `src/lib/emergency.ts` and reached from the `/e/[qr_token]` Server Component
page and a JSON Route Handler (`/api/emergency`).

### 10.1 Sequence

1. A provider scans the QR → the browser opens `https://app/e/{qr_token}`.
2. The proxy requires authentication; an unauthenticated visitor is redirected
   to the provider login (preserving `next`).
3. The page resolves the caller and confirms `role = provider` **and**
   `provider_status = approved`; otherwise it renders a 403-style notice.
4. The privileged read looks up `medical_profiles` by `qr_token` using the secret
   key, enforces the patient kill switch, decrypts the sensitive fields in
   memory, writes a de-duplicated audit log entry (capturing accessor identity),
   and fires an access notification.
5. It returns the **minimal triage view only** — never email, hashes, or account
   metadata. Unknown tokens return an identical "invalid or expired" response, so
   the endpoint reveals nothing about which tokens exist.

### 10.2 Privileged read (`src/lib/emergency.ts`)

```ts
export type EmergencyResult =
  | { status: "ok"; view: EmergencyView }
  | { status: "disabled" }
  | { status: "not_found" };

export async function readEmergencyProfile(
  token: string,
  accessor: Accessor,                 // { id, name, email }
): Promise<EmergencyResult> {
  const admin = createAdminClient();

  const { data: mp } = await admin
    .from("medical_profiles").select("*").eq("qr_token", token).maybeSingle();
  if (!mp) return { status: "not_found" };

  // Patient kill switch — paused records reveal nothing.
  if (mp.emergency_access_enabled === false) return { status: "disabled" };

  // De-duplicate rapid repeat views (refresh / prefetch) within a 2-minute window.
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from("access_logs").select("id")
    .eq("accessor_id", accessor.id).eq("patient_id", mp.id)
    .eq("access_type", "emergency_view").gte("created_at", since)
    .limit(1).maybeSingle();

  if (!recent) {
    await admin.from("access_logs").insert({
      accessor_id: accessor.id,
      patient_id: mp.id,
      access_type: "emergency_view",
      accessor_name: accessor.name,
      accessor_email: accessor.email,
    });
    notifyPatient(admin, mp.user_id, accessor).catch(() => {}); // fire-and-forget
  }

  const [allergies, medications, medical_conditions, additional_notes] = await Promise.all([
    decryptField(mp.allergies),
    decryptField(mp.medications),
    decryptField(mp.medical_conditions),
    decryptField(mp.additional_notes),
  ]);

  return { status: "ok", view: { /* …minimal triage fields… */ } };
}
```

### 10.3 Authorization at the page (`src/app/e/[qr_token]/page.tsx`)

```tsx
const session = await getCurrentProfile();
// (proxy already redirected unauthenticated users)

if (!isApprovedProvider(session.profile)) {
  // role !== provider, or provider_status !== approved → 403-style notice
}

const result = await readEmergencyProfile(qr_token, {
  id: session.user.id,
  name: session.profile.full_name,
  email: session.user.email ?? null,
});

if (result.status === "disabled")   return <PausedNotice />;
if (result.status === "not_found")  return <InvalidCodeNotice />;
return <TriageCard data={result.view} />;
```

### 10.4 JSON endpoint status contract (`src/app/api/emergency/route.ts`)

| Condition | Response |
|---|---|
| Missing token | `400` |
| Not authenticated | `401` |
| Authenticated but not an approved provider | `403` |
| Patient paused access (kill switch) | `403` |
| Unknown token | `404` (generic, no information leak) |
| Success | `200` with the minimal triage view + audit log written |

---

## 11. Provider Verification (trust boundary)

Self-registration alone cannot prove someone is a clinician — the known
limitation. The defensible mitigation: providers register with
`provider_status = 'pending'` and an administrator promotes them to `approved`.
The emergency path refuses access unless the caller is an approved provider. The
admin screen is gated by an email allowlist and uses the privileged client to
list pending providers (a read RLS would otherwise forbid):

```ts
// src/lib/admin-guard.ts
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}
export async function isAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  const email = user?.email?.toLowerCase();
  return Boolean(email && adminEmails().includes(email));
}

// src/app/admin/actions.ts
export async function approveProvider(_prev: ApproveState, formData: FormData): Promise<ApproveState> {
  try { await requireAdmin(); } catch { return { error: "You don't have permission to do that." }; }
  const providerId = formData.get("provider_id");
  const admin = createAdminClient();
  const { error } = await admin.from("profiles")
    .update({ provider_status: "approved" })
    .eq("id", providerId).eq("role", "provider");
  if (error) return { error: "Couldn't approve that provider. Try again." };
  revalidatePath("/admin");
  return {};
}
```

---

## 12. Accountability Features

### 12.1 Audit log with accessor identity

Every emergency access writes an append-only `access_logs` row. Because RLS
prevents a patient from reading another user's `profiles` row, the accessor's
name and email are **denormalised into the log at write time**, so the patient's
access-log page can display *who* viewed the record (not merely "a verified
provider").

### 12.2 Access notifications (pluggable)

On a newly logged access, the patient is emailed. The notifier is a pluggable
seam: with `RESEND_API_KEY` configured it sends via Resend; otherwise it is a
silent no-op, so the system runs without an email provider. Notification failure
never blocks the emergency read (fire-and-forget with `catch`).

```ts
// src/lib/notify.ts (excerpt)
export async function sendAccessNotification({ to, providerName, accessedAt }: AccessNotification) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !to) return; // deferred / not configured — no-op
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.RESEND_FROM, to,
        subject: "Your Beacon record was accessed", html: /* branded template */ "" }),
    });
  } catch { /* never break the read */ }
}
```

### 12.3 Patient kill switch

The `emergency_access_enabled` flag lets a patient pause all access. When off,
the privileged read returns `{ status: "disabled" }` and the provider sees a
"Emergency access is paused" notice — no data, no log entry. The control is a
toggle on the QR page backed by a Server Action:

```ts
export async function setEmergencyAccess(enabled: boolean): Promise<RegenerateState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };
  const { error } = await supabase.from("medical_profiles")
    .update({ emergency_access_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) return { error: "We couldn't update that. Please try again." };
  revalidatePath("/qr"); revalidatePath("/dashboard");
  return { ok: true };
}
```

---

## 13. User Interface and Design System

### 13.1 Design language

The product uses a "clinical-editorial / official-document" language: a Fraunces
display serif, monospaced tabular figures for vitals, a teal brand with warm
stone neutrals, and a subtle guilloché security texture reminiscent of a
passport. Patient mode is calm and spacious; the emergency triage card is bold
and high-contrast.

### 13.2 Non-negotiable clinical accessibility rules

- **Meaning is never carried by colour alone** — every status uses colour **+
  icon + text label** (≈8% of men have red–green colour blindness).
- **Red is reserved** for genuine criticals (allergies, danger).
- **Tabular figures** for blood group, phone numbers, dates, timestamps.
- **WCAG 2.2 AA** contrast; visible keyboard focus; layout survives 200% text
  zoom; large (≥44px) touch targets.
- **`prefers-reduced-motion`** disables all entrance animation.

These are encoded as design tokens in `globals.css` (`@theme`) and enforced in
the component library (`Button`, `Alert`, `Badge`, `Select`, `Dialog`, etc.).

### 13.3 The triage card

The signature screen orders information by clinical urgency: **Allergies → Blood
group → (age/sex/organ donor) → Medications → Conditions → Notes → Emergency
contacts → Primary doctor**, followed by an audit footer ("accessed {time} —
this access has been logged"). The allergies block is the loudest element when
present and explicitly states "No known allergies on file" when absent (absence
is itself clinical information).

---

## 14. SEO and Metadata

The root layout defines a title template, Open Graph and Twitter cards, a theme
colour, and `metadataBase`. App Router metadata files generate `robots.txt`,
`sitemap.xml`, a web manifest, and a dynamically rendered Open Graph image.
Private and sensitive routes (`/dashboard`, `/profile`, `/qr`, `/access-log`,
`/admin`, `/provider`, and especially `/e/[token]`) are excluded from crawling in
`robots.txt` and additionally carry `robots: { index: false }` metadata, so
medical pages can never be indexed even if a URL leaks.

---

## 15. Security Summary (mapping to test objectives)

| Threat / requirement | Mechanism |
|---|---|
| Unauthorised endpoint access | Proxy + `getUser()`; `/api/emergency` returns `401` when unauthenticated |
| Role violation | Approved-provider check → `403` |
| Cross-patient data leak | RLS (`user_id = auth.uid()`); no provider read policy |
| Tampered/forged session | `getUser()` validates the JWT server-side, not the raw cookie |
| SQL injection | Parameterised queries via the Supabase client; constrained enums/checks |
| Token guessing / unknown token | Identical `404`-style response; no information leak |
| Data-at-rest disclosure | AES-256-GCM field encryption; key separate from DB |
| Tampered ciphertext | GCM auth tag verification fails closed |
| Misuse by an approved provider | Audit log with accessor identity, access notification, revocable token, kill switch |

---

## 16. Configuration and Deployment

Environment variables:

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client+server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client | Publishable (anon) key — RLS-scoped |
| `SUPABASE_SECRET_KEY` | server only | Secret (service) key — privileged path; bypasses RLS |
| `BEACON_ENCRYPTION_KEY` | server only | base64 32-byte AES-256 key |
| `ADMIN_EMAILS` | server only | Admin allowlist for `/admin` |
| `NEXT_PUBLIC_APP_URL` | client+server | Base URL encoded into QR codes |
| `RESEND_API_KEY`, `RESEND_FROM` | server only | Optional access-notification email |

The app deploys to Render/Vercel; the database, auth, and migrations live in
Supabase. All traffic is over HTTPS/TLS.

---

## 17. Module Map

```
src/
  proxy.ts                         Edge session refresh + route guard
  app/
    (auth)/                        login, signup, forgot/reset password, actions
    (patient)/                     dashboard, profile/edit, qr, access-log (+ layout, actions)
    provider/                      provider signup/login/home/pending
    admin/                         provider approvals (+ actions)
    e/[qr_token]/                  emergency triage view
    auth/callback/                 email-link session exchange
    api/emergency/                 privileged emergency-read JSON endpoint
    robots.ts / sitemap.ts / manifest.ts / opengraph-image.tsx / not-found.tsx
  components/
    ui/                            Button, Input, Select, Dialog, Alert, Badge, Table, …
    auth/ patient/ emergency/ admin/   feature components (forms, triage card, toggles)
  lib/
    supabase/{client,server,admin}.ts  three DB client factories
    crypto.ts        AES-256-GCM field encryption
    auth.ts          session + profile resolution, role checks
    medical.ts       owner-side decrypt + completeness
    emergency.ts     privileged read, kill switch, audit, dedupe
    notify.ts        pluggable access-notification email
    qr.ts            QR generation + emergency URL
    validation.ts    Zod schemas
    rate-limit.ts    rate-limit seam (deferred)
    admin-guard.ts   admin allowlist
    database.types.ts  typed schema surface
supabase/
  migrations/0001_init.sql, 0002_extend.sql
  seed.sql           demo provider + admin
  templates/         branded auth email templates
  config.toml        email-template wiring
```

---

## 18. Known Limitations and Future Work

- **Provider verification** is a binary admin approval; any approved provider can
  read any token. Mitigations are detective (audit + notification) and
  recoverable (revoke + kill switch) rather than fully preventive. A stronger
  model (per-encounter authorisation, credential verification against a registry)
  is future work.
- **Rate limiting** is implemented as a no-op seam (`rate-limit.ts`) ready to be
  backed by Redis/Upstash for token-guessing and brute-force protection.
- **Encryption key management** uses a single static key; production deployments
  should add key rotation and a managed KMS.
- Encrypted fields are not searchable by design.
```

