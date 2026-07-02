"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isApprovedProvider } from "@/lib/auth";
import {
  lookupByEmail,
  lookupByNationalId,
  type EmergencyResult,
  type EmergencyView,
} from "@/lib/emergency";
import { clinicalEditSchema, nationalIdSchema } from "@/lib/validation";
import { applyClinicalEdit } from "@/lib/care-edit";
import type { CareAccessStatus } from "@/lib/database.types";

export type LookupState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      view: EmergencyView;
      patient_user_id: string;
      /** This doctor's current care-access standing with this patient, if any. */
      care_access_status: CareAccessStatus | null;
    }
  | { status: "disabled" }
  | { status: "not_found" };

/**
 * Backup patient lookup (BUILD_SPEC Phase 2), by national ID or account
 * email — for when a patient can't present their Beacon QR code. Either path
 * goes through the same privileged read, and logs + notifies the patient the
 * same way. Authorisation is re-checked here — never trust the client.
 */
export async function lookupPatient(
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

  const accessor = {
    id: session.user.id,
    name: session.profile.full_name,
    email: session.user.email ?? null,
  };

  const mode = formData.get("mode") === "email" ? "email" : "national_id";

  let lookup: EmergencyResult;
  if (mode === "email") {
    const parsed = z.email().safeParse(formData.get("query"));
    if (!parsed.success) {
      return { status: "error", message: "Enter a valid email address" };
    }
    lookup = await lookupByEmail(parsed.data, accessor);
  } else {
    const parsed = nationalIdSchema.safeParse(formData.get("query"));
    if (!parsed.success) {
      return {
        status: "error",
        message: parsed.error.issues[0]?.message ?? "Enter a valid national ID",
      };
    }
    lookup = await lookupByNationalId(parsed.data, accessor);
  }

  if (lookup.status !== "ok") return { status: lookup.status };

  const supabase = await createClient();
  const { data: careAccess } = await supabase
    .from("care_access_requests")
    .select("status")
    .eq("doctor_id", session.user.id)
    .eq("patient_user_id", lookup.patient_user_id)
    .maybeSingle();

  return {
    status: "ok",
    view: lookup.view,
    patient_user_id: lookup.patient_user_id,
    care_access_status: careAccess?.status ?? null,
  };
}

export interface CareAccessState {
  error?: string;
  ok?: boolean;
}

/**
 * A doctor requests edit access to a specific patient's clinical fields
 * (found via the lookup above). Always inserts/resets to 'pending' — the
 * care_access_requests RLS policies forbid a doctor setting anything else,
 * so only the patient can actually grant it.
 */
export async function requestCareAccess(
  _prev: CareAccessState,
  formData: FormData,
): Promise<CareAccessState> {
  const session = await getCurrentProfile();
  if (!session || !isApprovedProvider(session.profile)) {
    return { error: "Only approved providers can request access." };
  }

  const patientUserId = formData.get("patient_user_id");
  if (typeof patientUserId !== "string" || !patientUserId) {
    return { error: "Missing patient." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("care_access_requests").upsert(
    {
      doctor_id: session.user.id,
      patient_user_id: patientUserId,
      status: "pending",
    },
    { onConflict: "patient_user_id,doctor_id" },
  );

  if (error) {
    return { error: "We couldn't send that request. Please try again." };
  }

  revalidatePath("/provider/lookup");
  return { ok: true };
}

export interface ClinicalEditState {
  error?: string;
  ok?: boolean;
}

/**
 * A doctor saves an edit to a patient's clinical fields — only the four
 * encrypted free-text fields, and only once the patient has approved this
 * doctor's care-access request. applyClinicalEdit re-checks that grant
 * itself; this action never trusts the client's say-so.
 */
export async function submitClinicalEdit(
  _prev: ClinicalEditState,
  formData: FormData,
): Promise<ClinicalEditState> {
  const session = await getCurrentProfile();
  if (!session || !isApprovedProvider(session.profile)) {
    return { error: "Only approved providers can edit records." };
  }

  const patientUserId = formData.get("patient_user_id");
  if (typeof patientUserId !== "string" || !patientUserId) {
    return { error: "Missing patient." };
  }

  const parsed = clinicalEditSchema.safeParse({
    allergies: formData.get("allergies"),
    medications: formData.get("medications"),
    medical_conditions: formData.get("medical_conditions"),
    additional_notes: formData.get("additional_notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  }

  const result = await applyClinicalEdit(patientUserId, parsed.data, {
    id: session.user.id,
    name: session.profile.full_name,
    email: session.user.email ?? null,
  });

  if (result === "forbidden") {
    return { error: "You don't have edit access to this patient's record." };
  }
  if (result === "not_found") {
    return { error: "That patient's record couldn't be found." };
  }

  revalidatePath("/provider/lookup");
  return { ok: true };
}
