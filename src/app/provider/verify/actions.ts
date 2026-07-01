"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifyLicense } from "@/lib/verification";
import { uploadLicenseDoc } from "@/lib/storage";
import {
  councilFor,
  doctorRegistrationSchema,
  PRACTITIONER_TYPE_VALUES,
  LICENSE_FILE_TYPES,
  LICENSE_FILE_MAX_BYTES,
} from "@/lib/validation";

export interface VerifyState {
  error?: string;
  ok?: boolean;
}

const EXT_BY_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

/**
 * Submit a doctor's license for verification (BUILD_SPEC Phase 2). Validates the
 * license number + document, uploads the document to the private license bucket,
 * runs the (mock) registry check, and upserts the doctor's own
 * provider_verifications row via the RLS user client. Status stays 'pending' —
 * the pv_guard trigger forbids the client setting status/verified_by here.
 */
export async function submitLicenseVerification(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Please sign in again to continue." };
  }

  const license = doctorRegistrationSchema.shape.license_number.safeParse(
    formData.get("license_number"),
  );
  if (!license.success) {
    return { error: license.error.issues[0]?.message ?? "Enter a valid license number." };
  }
  const licenseNumber = license.data;

  const rawType = formData.get("practitioner_type");
  const practitionerType = (PRACTITIONER_TYPE_VALUES as readonly string[]).includes(
    String(rawType),
  )
    ? (rawType as "doctor" | "nurse")
    : "doctor";
  const council = councilFor(practitionerType);

  const file = formData.get("license_document");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Attach a copy of your license." };
  }
  if (!(LICENSE_FILE_TYPES as readonly string[]).includes(file.type)) {
    return { error: "Upload a PDF, PNG, or JPEG file." };
  }
  if (file.size > LICENSE_FILE_MAX_BYTES) {
    return { error: "That file is too large. Keep it under 5 MB." };
  }

  const ext = EXT_BY_TYPE[file.type] ?? "bin";
  const path = `${user.id}/license.${ext}`;

  try {
    const bytes = await file.arrayBuffer();
    await uploadLicenseDoc(path, bytes, file.type);
  } catch {
    return { error: "We couldn't upload your document. Please try again." };
  }

  const check = await verifyLicense(licenseNumber);

  // RLS user client: never set status/verified_by (pv_guard trigger blocks it).
  const { error } = await supabase.from("provider_verifications").upsert(
    {
      provider_id: user.id,
      license_number: licenseNumber,
      license_document_path: path,
      verify_check_result: check as never,
      practitioner_type: practitionerType,
      council,
    },
    { onConflict: "provider_id" },
  );

  if (error) {
    return { error: "We couldn't save your submission. Please try again." };
  }

  revalidatePath("/provider/verify");
  revalidatePath("/provider");
  return { ok: true };
}
