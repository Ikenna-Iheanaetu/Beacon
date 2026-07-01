"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifyFacility } from "@/lib/verification";
import { uploadInstitutionDoc } from "@/lib/storage";
import {
  institutionVerificationSchema,
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

/** Empty strings from optional inputs become null for the DB. */
function nullable(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length > 0 ? s : null;
}

/**
 * Submit a facility's registration for verification (Nigerian model). Validates
 * the registry identifiers + document, uploads the document to the private
 * institution bucket, runs the (mock) facility registry check, and upserts the
 * institution's own row via the RLS user client. Status stays 'pending' — the
 * inst_guard trigger forbids the client setting status/verified_by here.
 */
export async function submitInstitutionVerification(
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

  const parsed = institutionVerificationSchema.safeParse({
    name: formData.get("name"),
    facility_type: formData.get("facility_type"),
    nhfr_code: formData.get("nhfr_code"),
    state_moh_reg_no: formData.get("state_moh_reg_no"),
    cac_rc_number: formData.get("cac_rc_number"),
    medical_director_name: formData.get("medical_director_name"),
    medical_director_mdcn: formData.get("medical_director_mdcn"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }
  const data = parsed.data;

  // Require at least one facility registry number plus the Medical Director's
  // MDCN folio — the bridge to the individual-practitioner layer.
  const hasFacilityRegistry = Boolean(
    nullable(formData.get("nhfr_code")) ||
      nullable(formData.get("state_moh_reg_no")) ||
      nullable(formData.get("cac_rc_number")),
  );
  if (!hasFacilityRegistry) {
    return {
      error:
        "Provide at least one facility registry number (NHFR, State MoH, or CAC).",
    };
  }
  if (!nullable(formData.get("medical_director_mdcn"))) {
    return { error: "Enter your Medical Director's MDCN number." };
  }

  const file = formData.get("registration_document");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Attach your facility registration document." };
  }
  if (!(LICENSE_FILE_TYPES as readonly string[]).includes(file.type)) {
    return { error: "Upload a PDF, PNG, or JPEG file." };
  }
  if (file.size > LICENSE_FILE_MAX_BYTES) {
    return { error: "That file is too large. Keep it under 5 MB." };
  }

  const ext = EXT_BY_TYPE[file.type] ?? "bin";
  const path = `${user.id}/registration.${ext}`;

  try {
    const bytes = await file.arrayBuffer();
    await uploadInstitutionDoc(path, bytes, file.type);
  } catch {
    return { error: "We couldn't upload your document. Please try again." };
  }

  const check = await verifyFacility({
    nhfr_code: data.nhfr_code,
    state_moh_reg_no: data.state_moh_reg_no,
    cac_rc_number: data.cac_rc_number,
    medical_director_mdcn: data.medical_director_mdcn,
  });

  // RLS user client: never set status/verified_by (inst_guard trigger blocks it).
  const { error } = await supabase.from("institutions").upsert(
    {
      owner_id: user.id,
      name: data.name,
      facility_type: data.facility_type,
      nhfr_code: nullable(formData.get("nhfr_code")),
      state_moh_reg_no: nullable(formData.get("state_moh_reg_no")),
      cac_rc_number: nullable(formData.get("cac_rc_number")),
      medical_director_name: nullable(formData.get("medical_director_name")),
      medical_director_mdcn: nullable(formData.get("medical_director_mdcn")),
      registration_document_path: path,
      verify_check_result: check as never,
    },
    { onConflict: "owner_id" },
  );

  if (error) {
    return { error: "We couldn't save your submission. Please try again." };
  }

  revalidatePath("/institution/verify");
  revalidatePath("/institution");
  return { ok: true };
}
