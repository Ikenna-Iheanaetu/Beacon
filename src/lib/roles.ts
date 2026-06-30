import type { UserRole } from "@/lib/database.types";

/**
 * UI labels for roles. The DB enum keeps the value `provider` (no churn), but
 * the product presents it as "Doctor". Use these labels in copy instead of
 * hard-coding strings, so the relabel lives in one place.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  patient: "Patient",
  provider: "Doctor",
  admin: "Administrator",
};

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}
