import "server-only";
import { createClient } from "@/lib/supabase/server";
import { decryptField } from "@/lib/crypto";
import type { MedicalProfileRow } from "@/lib/database.types";

/** The signed-in patient's own raw (still-encrypted) medical row, or null. */
export async function getOwnMedicalProfile(): Promise<MedicalProfileRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("medical_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return data ?? null;
}

export interface DecryptedMedicalProfile extends Omit<
  MedicalProfileRow,
  "allergies" | "medications" | "medical_conditions" | "additional_notes"
> {
  allergies: string;
  medications: string;
  medical_conditions: string;
  additional_notes: string;
}

/**
 * The patient's own profile with the three sensitive fields decrypted.
 * Decryption happens server-side with the secret key — the key never reaches
 * the client. RLS ensures only the owner can read the row in the first place.
 */
export async function getOwnMedicalProfileDecrypted(): Promise<DecryptedMedicalProfile | null> {
  const row = await getOwnMedicalProfile();
  if (!row) return null;

  const [allergies, medications, medical_conditions, additional_notes, national_id] =
    await Promise.all([
      decryptField(row.allergies),
      decryptField(row.medications),
      decryptField(row.medical_conditions),
      decryptField(row.additional_notes),
      decryptField(row.national_id),
    ]);

  return {
    ...row,
    allergies,
    medications,
    medical_conditions,
    additional_notes,
    national_id: national_id || null,
  };
}

/** Profile completeness for the dashboard "is my passport ready?" answer. */
export function profileCompleteness(p: DecryptedMedicalProfile | null): {
  complete: boolean;
  filled: number;
  total: number;
} {
  const checks = [
    p?.blood_group && p.blood_group !== "unknown",
    p?.allergies,
    p?.medications,
    p?.medical_conditions,
    p?.emergency_contact_name,
    p?.emergency_contact_phone,
    p?.national_id,
  ];
  const total = checks.length;
  const filled = checks.filter(Boolean).length;
  return { complete: filled === total, filled, total };
}
