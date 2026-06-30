import "server-only";
import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Admin allowlist from ADMIN_EMAILS (comma-separated), lower-cased. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** True if the signed-in user's email is in the allowlist. */
export async function isAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  const email = user?.email?.toLowerCase();
  return Boolean(email && adminEmails().includes(email));
}

/**
 * Returns the verified admin's user, or throws "FORBIDDEN". Also mirrors the
 * allowlist into the DB `admin` role (so admin_actions FKs and audit reads are
 * coherent). The allowlist remains the authoritative gate — a stale DB role
 * grants nothing because every privileged action re-checks `isAdmin()`.
 */
export async function requireAdmin() {
  const user = await getSessionUser();
  const email = user?.email?.toLowerCase();
  if (!user || !email || !adminEmails().includes(email)) {
    throw new Error("FORBIDDEN");
  }
  // Opportunistic, idempotent role mirror.
  try {
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", user.id)
      .neq("role", "admin");
  } catch {
    // non-fatal — authorization already passed via the allowlist
  }
  return user;
}
