import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/database.types";
import type { User } from "@supabase/supabase-js";

/** The verified user (via getUser) or null. */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The verified user paired with their profiles row, or null if not signed in. */
export async function getCurrentProfile(): Promise<
  { user: User; profile: ProfileRow } | null
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return { user, profile: existing as ProfileRow };

  // Safety net: if the handle_new_user trigger didn't create a profile row
  // (e.g. the account predates the migration), provision it now from signup
  // metadata. The profiles INSERT policy allows a user to create their own row.
  const meta = user.user_metadata ?? {};
  const role =
    meta.role === "provider"
      ? "provider"
      : meta.role === "institution"
        ? "institution"
        : "patient";
  const { data: created } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        role,
        provider_status: role === "provider" ? "pending" : "none",
        full_name: (meta.full_name as string | undefined) ?? null,
      },
      { onConflict: "id" },
    )
    .select("*")
    .maybeSingle();

  return created ? { user, profile: created as ProfileRow } : null;
}

/** True only for a signed-in provider whose account is approved. */
export function isApprovedProvider(profile: ProfileRow | null | undefined): boolean {
  return profile?.role === "provider" && profile.provider_status === "approved";
}
