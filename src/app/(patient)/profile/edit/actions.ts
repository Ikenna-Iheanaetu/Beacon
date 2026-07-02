"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { encryptField } from "@/lib/crypto";
import { nationalIdHash } from "@/lib/verification";
import { medicalProfileSchema } from "@/lib/validation";

export interface SaveState {
  error?: string;
}

/**
 * Save the patient's medical profile (BUILD_SPEC §3, §8).
 *
 * The three sensitive fields are encrypted HERE, server-side, with the secret
 * AES key — the key never reaches the client. The write itself goes through the
 * user's RLS session, so ownership is still enforced at the data tier.
 */
export async function saveMedicalProfile(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired. Please sign in again." };
  }

  const parsed = medicalProfileSchema.safeParse({
    date_of_birth: formData.get("date_of_birth"),
    sex: formData.get("sex"),
    blood_group: formData.get("blood_group"),
    organ_donor: formData.get("organ_donor"),
    allergies: formData.get("allergies"),
    medications: formData.get("medications"),
    medical_conditions: formData.get("medical_conditions"),
    additional_notes: formData.get("additional_notes"),
    emergency_contact_name: formData.get("emergency_contact_name"),
    emergency_contact_phone: formData.get("emergency_contact_phone"),
    emergency_contact_relationship: formData.get("emergency_contact_relationship"),
    emergency_contact_2_name: formData.get("emergency_contact_2_name"),
    emergency_contact_2_phone: formData.get("emergency_contact_2_phone"),
    emergency_contact_2_relationship: formData.get("emergency_contact_2_relationship"),
    primary_physician_name: formData.get("primary_physician_name"),
    primary_physician_phone: formData.get("primary_physician_phone"),
    current_hospital_name: formData.get("current_hospital_name"),
    national_id: formData.get("national_id"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  }
  const v = parsed.data;

  const [allergies, medications, medical_conditions, additional_notes] =
    await Promise.all([
      encryptField(v.allergies),
      encryptField(v.medications),
      encryptField(v.medical_conditions),
      encryptField(v.additional_notes),
    ]);

  const organDonor =
    v.organ_donor === "yes" ? true : v.organ_donor === "no" ? false : null;

  const { error } = await supabase.from("medical_profiles").upsert(
    {
      user_id: user.id,
      date_of_birth: v.date_of_birth || null,
      sex: v.sex || null,
      blood_group: v.blood_group,
      organ_donor: organDonor,
      allergies,
      medications,
      medical_conditions,
      additional_notes,
      emergency_contact_name: v.emergency_contact_name || null,
      emergency_contact_phone: v.emergency_contact_phone || null,
      emergency_contact_relationship: v.emergency_contact_relationship || null,
      emergency_contact_2_name: v.emergency_contact_2_name || null,
      emergency_contact_2_phone: v.emergency_contact_2_phone || null,
      emergency_contact_2_relationship:
        v.emergency_contact_2_relationship || null,
      primary_physician_name: v.primary_physician_name || null,
      primary_physician_phone: v.primary_physician_phone || null,
      current_hospital_name: v.current_hospital_name || null,
      national_id: await encryptField(v.national_id),
      national_id_hash: v.national_id ? nationalIdHash(v.national_id) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: "We couldn't save your profile. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/qr");
  redirect("/dashboard?saved=1");
}
