"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/admin";

export interface ReviewState {
  error?: string;
}

/**
 * Approve a facility's registration. Admin-only, secret-key path. Marks the
 * institution verified and stamps the reviewer. Audited via
 * admin_actions(institution_approve). The inst_guard trigger only allows the
 * service_role to set status/verified_by/verified_at.
 */
export async function approveInstitution(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "You don't have permission to do that." };
  }

  const institutionId = formData.get("institution_id");
  if (typeof institutionId !== "string" || !institutionId) {
    return { error: "Missing institution." };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("institutions")
    .update({
      status: "verified",
      verified_by: admin.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", institutionId);

  if (error) return { error: "Couldn't approve that facility. Try again." };

  await logAdminAction({
    adminId: admin.id,
    actionType: "institution_approve",
    patientId: null,
    metadata: { institution_id: institutionId },
  });

  revalidatePath("/admin/institutions");
  return {};
}

/**
 * Reject a facility's registration with a reason. Admin-only, secret-key path.
 * Audited via admin_actions(institution_reject).
 */
export async function rejectInstitution(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "You don't have permission to do that." };
  }

  const institutionId = formData.get("institution_id");
  if (typeof institutionId !== "string" || !institutionId) {
    return { error: "Missing institution." };
  }

  const reason = String(formData.get("reason") ?? "").trim();

  const db = createAdminClient();
  const { error } = await db
    .from("institutions")
    .update({
      status: "rejected",
      verified_by: admin.id,
      verified_at: new Date().toISOString(),
      notes: reason || null,
    })
    .eq("id", institutionId);

  if (error) return { error: "Couldn't reject that facility. Try again." };

  await logAdminAction({
    adminId: admin.id,
    actionType: "institution_reject",
    patientId: null,
    metadata: { institution_id: institutionId },
  });

  revalidatePath("/admin/institutions");
  return {};
}
