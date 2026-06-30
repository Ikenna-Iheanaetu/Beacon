"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getOwnMedicalProfile } from "@/lib/medical";
import { buildEmergencyView } from "@/lib/emergency";
import { renderRecordPdf } from "@/lib/pdf";
import { qrDataUrl } from "@/lib/qr";
import { sendRecordTransfer } from "@/lib/notify";
import { recordTransferSchema } from "@/lib/validation";

export interface RegenerateState {
  error?: string;
  ok?: boolean;
}

/**
 * Regenerate the patient's QR token (BUILD_SPEC §7). Overwriting the token
 * instantly kills the old QR — any previously printed code stops working.
 */
export async function regenerateQrToken(): Promise<RegenerateState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const { error } = await supabase
    .from("medical_profiles")
    .update({ qr_token: crypto.randomUUID(), updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) return { error: "We couldn't regenerate your code. Try again." };

  revalidatePath("/qr");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Email the patient's own record to a recipient as a PDF attachment (WS4).
 * Patient self-service — no admin_actions log. Reuses the emergency view +
 * pdf-lib renderer, then hands off to the pluggable Resend seam.
 */
export async function emailOwnRecord(
  _prev: RegenerateState,
  formData: FormData,
): Promise<RegenerateState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const parsed = recordTransferSchema.safeParse({
    recipient: formData.get("recipient"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Check the details and try again.",
    };
  }

  const row = await getOwnMedicalProfile();
  if (!row) {
    return { error: "Create your health passport before sharing it." };
  }

  const current = await getCurrentProfile();
  const patientName = current?.profile.full_name ?? null;
  const view = await buildEmergencyView(row, patientName);

  const pdf = await renderRecordPdf({
    view,
    qrPngDataUrl: await qrDataUrl(row.qr_token),
    generatedFor: "Patient self-export",
  });

  const sent = await sendRecordTransfer({
    to: parsed.data.recipient,
    patientName,
    pdf,
    sentBy: "patient",
    note: parsed.data.note || undefined,
  });

  if (!sent) {
    return {
      error:
        "We couldn't send the email right now. Download the PDF and share it directly.",
    };
  }

  return { ok: true };
}

/** Patient kill switch: pause or resume all emergency access (BUILD_SPEC §7). */
export async function setEmergencyAccess(
  enabled: boolean,
): Promise<RegenerateState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const { error } = await supabase
    .from("medical_profiles")
    .update({
      emergency_access_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return { error: "We couldn't update that. Please try again." };

  revalidatePath("/qr");
  revalidatePath("/dashboard");
  return { ok: true };
}
