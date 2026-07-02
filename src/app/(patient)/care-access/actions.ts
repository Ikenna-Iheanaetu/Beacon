"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface CareAccessDecisionState {
  error?: string;
}

/**
 * Patient decides on a doctor's care-access request — approve, reject, or
 * revoke a previously approved grant. The car_update_patient_decide RLS
 * policy restricts this to rows where patient_user_id = auth.uid(), so the
 * RLS client is sufficient — no service-role escalation needed.
 */
async function decide(
  requestId: string,
  status: "approved" | "rejected" | "revoked",
): Promise<CareAccessDecisionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again to continue." };

  const { error } = await supabase
    .from("care_access_requests")
    .update({ status, decided_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) return { error: "That didn't work. Please try again." };

  revalidatePath("/care-access");
  return {};
}

export async function approveCareAccess(
  _prev: CareAccessDecisionState,
  formData: FormData,
): Promise<CareAccessDecisionState> {
  const requestId = formData.get("request_id");
  if (typeof requestId !== "string" || !requestId) return { error: "Missing request." };
  return decide(requestId, "approved");
}

export async function rejectCareAccess(
  _prev: CareAccessDecisionState,
  formData: FormData,
): Promise<CareAccessDecisionState> {
  const requestId = formData.get("request_id");
  if (typeof requestId !== "string" || !requestId) return { error: "Missing request." };
  return decide(requestId, "rejected");
}

export async function revokeCareAccess(
  _prev: CareAccessDecisionState,
  formData: FormData,
): Promise<CareAccessDecisionState> {
  const requestId = formData.get("request_id");
  if (typeof requestId !== "string" || !requestId) return { error: "Missing request." };
  return decide(requestId, "revoked");
}
