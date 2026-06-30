"use server";

import { requireAdmin } from "@/lib/admin-guard";
import {
  adminReadRecord,
  logAdminAction,
  type AdminRecordView,
} from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { nationalIdHash } from "@/lib/verification";
import { renderRecordPdf } from "@/lib/pdf";
import { sendRecordTransfer } from "@/lib/notify";
import { recordTransferSchema } from "@/lib/validation";

/** A patient match shown in the search results. */
export interface PatientMatch {
  patientId: string; // medical_profiles.id
  name: string | null;
  email: string | null;
}

export interface SearchState {
  query?: string;
  mode?: "email" | "national_id";
  matches?: PatientMatch[];
  error?: string;
}

/** The admin's display name for the audit/access logs. */
async function adminName(): Promise<string | null> {
  const ctx = await getCurrentProfile();
  return ctx?.profile.full_name ?? ctx?.user.email ?? null;
}

/**
 * Search for a patient by email or national ID. Email lookups resolve the auth
 * user id then match medical_profiles.user_id; national-ID lookups match the
 * keyed hash. Never reveals decrypted PII — only name/email for selection.
 */
export async function searchPatients(
  _prev: SearchState,
  formData: FormData,
): Promise<SearchState> {
  try {
    await requireAdmin();
  } catch {
    return { error: "You are not authorized to perform this search." };
  }

  const mode = (formData.get("mode") as string) === "national_id"
    ? "national_id"
    : "email";
  const query = String(formData.get("query") ?? "").trim();

  if (!query) {
    return { mode, error: "Enter an email or national ID to search." };
  }

  const admin = createAdminClient();

  if (mode === "email") {
    const target = query.toLowerCase();
    const { data: userList } = await admin.auth.admin.listUsers({
      perPage: 1000,
    });
    const user = userList?.users.find(
      (u) => u.email?.toLowerCase() === target,
    );
    if (!user) {
      return { mode, query, matches: [] };
    }
    const { data: profiles } = await admin
      .from("medical_profiles")
      .select("id, user_id")
      .eq("user_id", user.id);

    const matches = await profilesToMatches(
      admin,
      (profiles ?? []).map((p) => ({ id: p.id, user_id: p.user_id })),
    );
    return { mode, query, matches };
  }

  // national_id
  let hash: string;
  try {
    hash = nationalIdHash(query);
  } catch {
    return { mode, query, error: "National ID lookup is not configured." };
  }
  const { data: profiles } = await admin
    .from("medical_profiles")
    .select("id, user_id")
    .eq("national_id_hash", hash);

  const matches = await profilesToMatches(
    admin,
    (profiles ?? []).map((p) => ({ id: p.id, user_id: p.user_id })),
  );
  return { mode, query, matches };
}

/** Resolve names (from profiles) + emails (from auth) for a set of matches. */
async function profilesToMatches(
  admin: ReturnType<typeof createAdminClient>,
  rows: { id: string; user_id: string }[],
): Promise<PatientMatch[]> {
  if (rows.length === 0) return [];

  const userIds = rows.map((r) => r.user_id);
  const { data: profs } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);
  const nameById = new Map(
    (profs ?? []).map((p) => [p.id, p.full_name as string | null]),
  );

  const { data: userList } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  const emailById = new Map(
    (userList?.users ?? []).map((u) => [u.id, u.email ?? null]),
  );

  return rows.map((r) => ({
    patientId: r.id,
    name: nameById.get(r.user_id) ?? null,
    email: emailById.get(r.user_id) ?? null,
  }));
}

export interface OpenRecordState {
  view?: AdminRecordView["view"];
  patientId?: string;
  reason?: string;
  error?: string;
}

/**
 * Open a record after a reason is supplied. adminReadRecord enforces the reason
 * length and writes both the admin audit row and the patient-visible access log.
 */
export async function openRecord(
  _prev: OpenRecordState,
  formData: FormData,
): Promise<OpenRecordState> {
  let adminUser;
  try {
    adminUser = await requireAdmin();
  } catch {
    return { error: "You are not authorized to open records." };
  }

  const patientId = String(formData.get("patientId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (!patientId) return { error: "No record was selected." };

  try {
    const result = await adminReadRecord({
      patientId,
      reason,
      adminId: adminUser.id,
      adminName: await adminName(),
    });
    return { view: result.view, patientId, reason };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not open the record.",
    };
  }
}

export interface EmailRecordState {
  ok?: boolean;
  message?: string;
  error?: string;
}

/**
 * Email an opened record as a PDF to a recipient. Re-derives the record via
 * adminReadRecord (which re-logs the read with the supplied reason), then logs
 * an email_send action with the recipient in metadata.
 */
export async function emailRecord(
  _prev: EmailRecordState,
  formData: FormData,
): Promise<EmailRecordState> {
  let adminUser;
  try {
    adminUser = await requireAdmin();
  } catch {
    return { error: "You are not authorized to share records." };
  }

  const patientId = String(formData.get("patientId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const parsed = recordTransferSchema.safeParse({
    recipient: formData.get("recipient"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  if (!patientId) return { error: "No record was selected." };

  try {
    const { view } = await adminReadRecord({
      patientId,
      reason,
      adminId: adminUser.id,
      adminName: await adminName(),
    });
    const pdf = await renderRecordPdf({ view, generatedFor: "Admin export" });
    const note = parsed.data.note || undefined;
    const sent = await sendRecordTransfer({
      to: parsed.data.recipient,
      patientName: view.patient_name,
      pdf,
      sentBy: "admin",
      note,
    });
    await logAdminAction({
      adminId: adminUser.id,
      actionType: "email_send",
      patientId,
      reason: note ?? reason,
      metadata: { recipient: parsed.data.recipient, sent },
    });

    return sent
      ? { ok: true, message: `Record sent to ${parsed.data.recipient}.` }
      : {
          ok: false,
          message:
            "Email delivery is not configured, but the action was logged.",
        };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not send the record.",
    };
  }
}
