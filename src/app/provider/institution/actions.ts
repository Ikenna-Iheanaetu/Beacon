"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface AffiliationState {
  error?: string;
  ok?: boolean;
}

/**
 * Request affiliation with a verified facility (Increment 2). Always inserts as
 * 'pending' — the im_insert_own_member RLS policy forbids anything else, and
 * only the institution's own owner account can later approve or reject it.
 */
export async function requestAffiliation(
  _prev: AffiliationState,
  formData: FormData,
): Promise<AffiliationState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Please sign in again to continue." };
  }

  const institutionId = formData.get("institution_id");
  if (typeof institutionId !== "string" || !institutionId) {
    return { error: "Choose a facility to request." };
  }

  const { error } = await supabase.from("institution_members").insert({
    institution_id: institutionId,
    member_id: user.id,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You've already requested affiliation with this facility." };
    }
    return { error: "We couldn't send that request. Please try again." };
  }

  revalidatePath("/provider/institution");
  return { ok: true };
}
