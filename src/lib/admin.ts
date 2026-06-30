import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptField } from "@/lib/crypto";
import { buildEmergencyView, type EmergencyView } from "@/lib/emergency";
import type { AdminActionType } from "@/lib/database.types";

/**
 * Privileged admin operations (BUILD_SPEC Phase 2). Admin record access is
 * reason-logged: every read/export/email writes an `admin_actions` row, and a
 * record view is ALSO surfaced in the patient's own access log for transparency.
 * All access stays on the secret-key path (no RLS read policy for admins).
 */

export async function logAdminAction(input: {
  adminId: string;
  actionType: AdminActionType;
  patientId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("admin_actions").insert({
    admin_id: input.adminId,
    action_type: input.actionType,
    patient_id: input.patientId ?? null,
    reason: input.reason ?? null,
    metadata: (input.metadata ?? null) as never,
  });
}

export interface AdminRecordView {
  patientId: string;
  view: EmergencyView;
  nationalId: string;
  patientEmail: string | null;
}

/**
 * Read a patient's full record as an admin. Hard-fails on a blank reason so the
 * audit guarantee is unbypassable. Writes `admin_actions(record_view)` AND a
 * patient-visible `access_logs(admin_review)` row.
 *
 * @param patientId  medical_profiles.id
 */
export async function adminReadRecord(opts: {
  patientId: string;
  reason: string;
  adminId: string;
  adminName: string | null;
}): Promise<AdminRecordView> {
  const reason = opts.reason?.trim();
  if (!reason || reason.length < 10) {
    throw new Error("A reason (min 10 characters) is required to open a record.");
  }

  const admin = createAdminClient();
  const { data: mp } = await admin
    .from("medical_profiles")
    .select("*")
    .eq("id", opts.patientId)
    .maybeSingle();
  if (!mp) throw new Error("Record not found.");

  const { data: prof } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", mp.user_id)
    .maybeSingle();

  // Audit (admin side) + transparency (patient side).
  await logAdminAction({
    adminId: opts.adminId,
    actionType: "record_view",
    patientId: mp.id,
    reason,
  });
  await admin.from("access_logs").insert({
    accessor_id: opts.adminId,
    patient_id: mp.id,
    access_type: "admin_review",
    accessor_name: opts.adminName ?? "Administrator",
    note: `Administrative review — ${reason}`,
  });

  const view = await buildEmergencyView(mp, prof?.full_name ?? null);
  const nationalId = await decryptField(mp.national_id);
  return { patientId: mp.id, view, nationalId, patientEmail: null };
}
