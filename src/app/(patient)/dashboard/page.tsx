import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  Pencil,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getOwnMedicalProfileDecrypted,
  type DecryptedMedicalProfile,
} from "@/lib/medical";
import { qrDataUrl } from "@/lib/qr";
import { Button } from "@/components/ui/button";
import { SavedToast } from "@/components/patient/saved-toast";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function checklist(p: DecryptedMedicalProfile | null) {
  return [
    { label: "Blood group", done: Boolean(p && p.blood_group !== "unknown") },
    { label: "Allergies", done: Boolean(p?.allergies) },
    { label: "Medications", done: Boolean(p?.medications) },
    { label: "Conditions", done: Boolean(p?.medical_conditions) },
    { label: "Contact name", done: Boolean(p?.emergency_contact_name) },
    { label: "Contact phone", done: Boolean(p?.emergency_contact_phone) },
  ];
}

function Ring({ pct }: { pct: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" className="size-32 -rotate-90">
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth="10"
      />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * pct) / 100}
      />
    </svg>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await searchParams;
  const profile = await getOwnMedicalProfileDecrypted();
  const items = checklist(profile);
  const filled = items.filter((i) => i.done).length;
  const pct = Math.round((filled / items.length) * 100);
  const complete = filled === items.length;

  const supabase = await createClient();
  const { data: logs } = profile
    ? await supabase
        .from("access_logs")
        .select("id, access_type, created_at, accessor_name")
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  const qr = profile ? await qrDataUrl(profile.qr_token) : null;

  return (
    <div className="flex flex-col gap-8">
      {sp.saved && <SavedToast />}

      <header className="beacon-rise">
        <span className="data-label text-primary-400">Your passport</span>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">
          {profile ? "Welcome back" : "Let's set up your passport"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep it complete so it&apos;s ready the moment someone needs it.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Completeness — document status */}
        <section className="surface beacon-rise [animation-delay:60ms] p-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <div className="relative grid shrink-0 place-items-center">
              <Ring pct={pct} />
              <div className="absolute flex flex-col items-center">
                <span className="data-value text-3xl font-bold">{pct}%</span>
                <span className="data-label">complete</span>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                {complete ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-safe/10 px-2.5 py-1 text-xs font-semibold text-safe">
                    <ShieldCheck className="size-3.5" />
                    Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-caution/10 px-2.5 py-1 text-xs font-semibold text-caution">
                    <Clock className="size-3.5" />
                    {profile ? "Almost there" : "Not started"}
                  </span>
                )}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
                {items.map((it) => (
                  <div key={it.label} className="flex items-center gap-2 text-sm">
                    {it.done ? (
                      <CheckCircle2 className="size-4 shrink-0 text-safe" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground/50" />
                    )}
                    <span
                      className={
                        it.done ? "text-foreground" : "text-muted-foreground"
                      }
                    >
                      {it.label}
                    </span>
                  </div>
                ))}
              </dl>
              <Button asChild className="mt-5">
                <Link href="/profile/edit">
                  <Pencil />
                  {profile ? "Edit details" : "Add your details"}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* QR ID card preview */}
        <section className="surface beacon-rise [animation-delay:120ms] bg-guilloche flex flex-col items-center overflow-hidden p-6">
          <span className="data-label self-start">Your emergency code</span>
          {qr ? (
            <>
              <div className="mt-4 rounded-2xl border border-border bg-card p-3 shadow-sm">
                <Image
                  src={qr}
                  alt="Your Beacon emergency QR code"
                  width={176}
                  height={176}
                  className="rounded-lg"
                  unoptimized
                />
              </div>
              <Button asChild variant="outline" className="mt-5">
                <Link href="/qr">
                  <QrCode />
                  View &amp; download
                </Link>
              </Button>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
              <QrCode className="size-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                Add your details to generate a code.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Access log */}
      <section className="surface beacon-rise [animation-delay:180ms] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Who has seen my record?
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Every emergency access is logged here.
            </p>
          </div>
          <Link
            href="/access-log"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {logs && logs.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-3">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-info/10 text-info">
                  <ShieldCheck className="size-4" />
                </span>
                <span className="flex-1 text-sm text-foreground">
                  {log.accessor_name
                    ? `Emergency view by ${log.accessor_name}`
                    : "Emergency view by a verified doctor"}
                </span>
                <span className="data-value text-sm text-muted-foreground">
                  {formatWhen(log.created_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No one has accessed your record yet.
          </p>
        )}
      </section>
    </div>
  );
}
