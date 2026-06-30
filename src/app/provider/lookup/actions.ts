"use server";

import { getCurrentProfile, isApprovedProvider } from "@/lib/auth";
import { lookupByNationalId, type EmergencyView } from "@/lib/emergency";
import { nationalIdSchema } from "@/lib/validation";

export type LookupState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok"; view: EmergencyView }
  | { status: "disabled" }
  | { status: "not_found" };

/**
 * National-ID backup lookup (BUILD_SPEC Phase 2). An approved doctor enters a
 * patient's national ID; the privileged read path matches by keyed hash, logs
 * the access in the patient-visible audit trail, and returns the triage view.
 *
 * Authorisation is re-checked here — never trust the client to gate this.
 */
export async function lookupNationalId(
  _prev: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const session = await getCurrentProfile();
  if (!session || !isApprovedProvider(session.profile)) {
    return {
      status: "error",
      message: "Only approved providers can look up records.",
    };
  }

  const parsed = nationalIdSchema.safeParse(formData.get("national_id"));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Enter a valid national ID",
    };
  }

  const result = await lookupByNationalId(parsed.data, {
    id: session.user.id,
    name: session.profile.full_name,
    email: session.user.email ?? null,
  });

  if (result.status === "ok") return { status: "ok", view: result.view };
  return { status: result.status };
}
