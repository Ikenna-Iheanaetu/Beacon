"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/lib/admin";

export interface ReviewState {
  error?: string;
}

/**
 * Approve a doctor's license (BUILD_SPEC Phase 2). Admin-only, secret-key path.
 * Marks the verification verified, stamps the reviewer, and flips the doctor's
 * profile to approved. Audited via admin_actions(provider_approve).
 */
export async function approveVerification(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "You don't have permission to do that." };
  }

  const providerId = formData.get("provider_id");
  if (typeof providerId !== "string" || !providerId) {
    return { error: "Missing provider." };
  }

  const db = createAdminClient();

  const { error: vErr } = await db
    .from("provider_verifications")
    .update({
      status: "verified",
      verified_by: admin.id,
      verified_at: new Date().toISOString(),
    })
    .eq("provider_id", providerId);

  if (vErr) return { error: "Couldn't approve that license. Try again." };

  const { error: pErr } = await db
    .from("profiles")
    .update({ provider_status: "approved" })
    .eq("id", providerId)
    .eq("role", "provider");

  if (pErr) return { error: "Couldn't update the doctor's status. Try again." };

  await logAdminAction({
    adminId: admin.id,
    actionType: "provider_approve",
    patientId: null,
    metadata: { provider_id: providerId },
  });

  revalidatePath("/admin/verifications");
  return {};
}

/**
 * Reject a doctor's license with a reason. Admin-only, secret-key path.
 * Audited via admin_actions(provider_reject).
 */
export async function rejectVerification(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "You don't have permission to do that." };
  }

  const providerId = formData.get("provider_id");
  if (typeof providerId !== "string" || !providerId) {
    return { error: "Missing provider." };
  }

  const reason = String(formData.get("reason") ?? "").trim();

  const db = createAdminClient();
  const { error } = await db
    .from("provider_verifications")
    .update({
      status: "rejected",
      verified_by: admin.id,
      verified_at: new Date().toISOString(),
      notes: reason || null,
    })
    .eq("provider_id", providerId);

  if (error) return { error: "Couldn't reject that license. Try again." };

  await logAdminAction({
    adminId: admin.id,
    actionType: "provider_reject",
    patientId: null,
    metadata: { provider_id: providerId },
  });

  revalidatePath("/admin/verifications");
  return {};
}
