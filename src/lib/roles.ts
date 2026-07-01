import type { PractitionerType, UserRole } from "@/lib/database.types";

/**
 * UI labels for roles. The DB enum keeps the value `provider` (no churn), but
 * the product presents it as "Doctor" by default. Use these labels in copy
 * instead of hard-coding strings, so the relabel lives in one place.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  patient: "Patient",
  provider: "Doctor",
  admin: "Administrator",
  institution: "Healthcare Institution",
};

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}

/**
 * A `provider` account can be a doctor (MDCN) or a nurse/midwife (NMCN) — see
 * provider_verifications.practitioner_type. Use this label wherever the
 * specific practitioner type is known instead of the generic "Doctor" role label.
 */
export const PRACTITIONER_TYPE_LABELS: Record<PractitionerType, string> = {
  doctor: "Doctor",
  nurse: "Nurse",
};

export function practitionerTypeLabel(type: PractitionerType): string {
  return PRACTITIONER_TYPE_LABELS[type];
}
