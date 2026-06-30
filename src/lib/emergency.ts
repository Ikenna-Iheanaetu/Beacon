import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptField } from "@/lib/crypto";
import { sendAccessNotification } from "@/lib/notify";
import { nationalIdHash } from "@/lib/verification";
import type { MedicalProfileRow, Sex } from "@/lib/database.types";

/**
 * The privileged emergency read path (BUILD_SPEC §7). The ONE place that
 * crosses the row-owner boundary, decrypts sensitive fields, writes the audit
 * log, and notifies the patient — all via the secret key.
 *
 * The caller must already have authenticated the provider and confirmed
 * role=provider + provider_status=approved BEFORE calling readEmergencyProfile.
 */

export interface EmergencyContact {
  name: string | null;
  phone: string | null;
  relationship: string | null;
}

/** The minimal emergency view — never email, hashes, or account metadata. */
export interface EmergencyView {
  patient_name: string | null;
  date_of_birth: string | null;
  sex: Sex | null;
  blood_group: string;
  organ_donor: boolean | null;
  allergies: string;
  medications: string;
  medical_conditions: string;
  additional_notes: string;
  emergency_contact: EmergencyContact;
  emergency_contact_2: EmergencyContact;
  primary_physician: { name: string | null; phone: string | null };
  accessed_at: string;
}

export type EmergencyResult =
  | { status: "ok"; view: EmergencyView }
  | { status: "disabled" }
  | { status: "not_found" };

/** Build the decrypted view from a medical_profiles row. Shared by the
 *  emergency, national-ID, and admin read paths. */
export async function buildEmergencyView(
  mp: MedicalProfileRow,
  patientName: string | null,
): Promise<EmergencyView> {
  const [allergies, medications, medical_conditions, additional_notes] =
    await Promise.all([
      decryptField(mp.allergies),
      decryptField(mp.medications),
      decryptField(mp.medical_conditions),
      decryptField(mp.additional_notes),
    ]);

  return {
    patient_name: patientName,
    date_of_birth: mp.date_of_birth,
    sex: mp.sex,
    blood_group: mp.blood_group,
    organ_donor: mp.organ_donor,
    allergies,
    medications,
    medical_conditions,
    additional_notes,
    emergency_contact: {
      name: mp.emergency_contact_name,
      phone: mp.emergency_contact_phone,
      relationship: mp.emergency_contact_relationship,
    },
    emergency_contact_2: {
      name: mp.emergency_contact_2_name,
      phone: mp.emergency_contact_2_phone,
      relationship: mp.emergency_contact_2_relationship,
    },
    primary_physician: {
      name: mp.primary_physician_name,
      phone: mp.primary_physician_phone,
    },
    accessed_at: new Date().toISOString(),
  };
}

async function patientName(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name ?? null;
}

/** Does this token map to a record? Same answer shape for every unknown token. */
export async function tokenExists(token: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("medical_profiles")
    .select("id")
    .eq("qr_token", token)
    .maybeSingle();
  return Boolean(data);
}

/** Who is doing the access — captured into the audit log for accountability. */
export interface Accessor {
  id: string;
  name: string | null;
  email: string | null;
}

export async function readEmergencyProfile(
  token: string,
  accessor: Accessor,
): Promise<EmergencyResult> {
  const admin = createAdminClient();

  const { data: mp } = await admin
    .from("medical_profiles")
    .select("*")
    .eq("qr_token", token)
    .maybeSingle();

  if (!mp) return { status: "not_found" };

  // Patient kill switch (BUILD_SPEC §7) — patient can pause all access.
  if (mp.emergency_access_enabled === false) return { status: "disabled" };

  // Audit the access, de-duplicating rapid repeat views by the same provider.
  const DEDUPE_WINDOW_MS = 2 * 60 * 1000;
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
  const { data: recent } = await admin
    .from("access_logs")
    .select("id")
    .eq("accessor_id", accessor.id)
    .eq("patient_id", mp.id)
    .eq("access_type", "emergency_view")
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();

  if (!recent) {
    await admin.from("access_logs").insert({
      accessor_id: accessor.id,
      patient_id: mp.id,
      access_type: "emergency_view",
      accessor_name: accessor.name,
      accessor_email: accessor.email,
    });

    // Notify the patient that their record was opened (fire-and-forget).
    notifyPatient(admin, mp.user_id, accessor).catch(() => {});
  }

  const view = await buildEmergencyView(mp, await patientName(admin, mp.user_id));
  return { status: "ok", view };
}

/**
 * National-ID backup lookup (BUILD_SPEC Phase 2). When a patient has no QR on
 * them, an approved doctor can retrieve the record by national ID. Matched by
 * the keyed hash (encrypted column isn't queryable). Logged in the
 * patient-visible access_logs as `national_id_lookup`.
 *
 * Caller must confirm the accessor is an approved doctor first.
 */
export async function lookupByNationalId(
  rawNationalId: string,
  accessor: Accessor,
): Promise<EmergencyResult> {
  const admin = createAdminClient();
  const hash = nationalIdHash(rawNationalId);

  const { data: mp } = await admin
    .from("medical_profiles")
    .select("*")
    .eq("national_id_hash", hash)
    .maybeSingle();

  if (!mp) return { status: "not_found" };
  if (mp.emergency_access_enabled === false) return { status: "disabled" };

  await admin.from("access_logs").insert({
    accessor_id: accessor.id,
    patient_id: mp.id,
    access_type: "national_id_lookup",
    accessor_name: accessor.name,
    accessor_email: accessor.email,
    note: "Looked up by national ID (no QR present)",
  });
  notifyPatient(admin, mp.user_id, accessor).catch(() => {});

  const view = await buildEmergencyView(mp, await patientName(admin, mp.user_id));
  return { status: "ok", view };
}

/** Look up the patient's email (auth side) and send the access notification. */
async function notifyPatient(
  admin: ReturnType<typeof createAdminClient>,
  patientUserId: string,
  accessor: Accessor,
): Promise<void> {
  const { data } = await admin.auth.admin.getUserById(patientUserId);
  const to = data.user?.email;
  if (!to) return;
  await sendAccessNotification({
    to,
    providerName: accessor.name || accessor.email || "A verified doctor",
    accessedAt: new Date(),
  });
}
