"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface MemberReviewState {
  error?: string;
}

/**
 * Approve a practitioner's affiliation request. The im_update_own_institution
 * RLS policy already restricts this to the institution's own owner account, so
 * the RLS user client is sufficient — no service-role escalation needed (unlike
 * facility/provider verification, there's no self-approval risk here).
 */
export async function approveMember(
  _prev: MemberReviewState,
  formData: FormData,
): Promise<MemberReviewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again to continue." };

  const memberRowId = formData.get("member_row_id");
  if (typeof memberRowId !== "string" || !memberRowId) {
    return { error: "Missing request." };
  }

  const { error } = await supabase
    .from("institution_members")
    .update({
      status: "approved",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", memberRowId);

  if (error) return { error: "Couldn't approve that request. Try again." };

  revalidatePath("/institution/members");
  return {};
}

/** Reject a practitioner's affiliation request, with an optional reason. */
export async function rejectMember(
  _prev: MemberReviewState,
  formData: FormData,
): Promise<MemberReviewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again to continue." };

  const memberRowId = formData.get("member_row_id");
  if (typeof memberRowId !== "string" || !memberRowId) {
    return { error: "Missing request." };
  }

  const reason = String(formData.get("reason") ?? "").trim();

  const { error } = await supabase
    .from("institution_members")
    .update({
      status: "rejected",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      notes: reason || null,
    })
    .eq("id", memberRowId);

  if (error) return { error: "Couldn't reject that request. Try again." };

  revalidatePath("/institution/members");
  return {};
}
