import { z } from "zod";

/** Blood groups accepted by the DB CHECK constraint (BUILD_SPEC §4). */
export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "unknown",
] as const;

export type BloodGroup = (typeof BLOOD_GROUPS)[number];

/** Plain-language sex options (BUILD_SPEC §10.2). */
export const SEX_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "intersex", label: "Intersex" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
  { value: "unknown", label: "Unknown" },
] as const;

export const SEX_VALUES = SEX_OPTIONS.map((o) => o.value) as [
  "female",
  "male",
  "intersex",
  "prefer_not_to_say",
  "unknown",
];

export const ORGAN_DONOR_OPTIONS = [
  { value: "unknown", label: "Not specified" },
  { value: "yes", label: "Yes, I'm a donor" },
  { value: "no", label: "No" },
] as const;

export const optionalText = z
  .string()
  .trim()
  .max(2000, "Please keep this under 2000 characters")
  .optional()
  .or(z.literal(""));

const optionalName = z
  .string()
  .trim()
  .max(120, "Please keep this under 120 characters")
  .optional()
  .or(z.literal(""));

const optionalPhone = z
  .string()
  .trim()
  .max(40, "Please keep the phone number under 40 characters")
  .regex(/^[+()\-\s\d]*$/, "Use only digits, spaces, and + ( ) -")
  .optional()
  .or(z.literal(""));

/** National ID, used both for saving and for the doctor lookup. Mandatory —
 *  it's the only reliable way for a provider to find a record with no QR. */
export const nationalIdSchema = z
  .string()
  .trim()
  .min(5, "Enter a valid national ID")
  .max(40, "Enter a valid national ID")
  .regex(/^[A-Za-z0-9-]+$/, "Use only letters, numbers, and dashes");

/** Medical profile form (the main patient form). Plain-language fields. */
export const medicalProfileSchema = z.object({
  // About you
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
    .optional()
    .or(z.literal("")),
  sex: z.enum(SEX_VALUES).optional().or(z.literal("")),
  blood_group: z.enum(BLOOD_GROUPS),
  organ_donor: z.enum(["yes", "no", "unknown"]).optional().or(z.literal("")),
  // Clinical (encrypted free-text)
  allergies: optionalText,
  medications: optionalText,
  medical_conditions: optionalText,
  additional_notes: optionalText,
  // Emergency contacts
  emergency_contact_name: optionalName,
  emergency_contact_phone: optionalPhone,
  emergency_contact_relationship: optionalName,
  emergency_contact_2_name: optionalName,
  emergency_contact_2_phone: optionalPhone,
  emergency_contact_2_relationship: optionalName,
  // Primary doctor
  primary_physician_name: optionalName,
  primary_physician_phone: optionalPhone,
  // Current hospital (shown on the public emergency view alongside the doctor above)
  current_hospital_name: z
    .string()
    .trim()
    .max(160, "Please keep this under 160 characters")
    .optional()
    .or(z.literal("")),
  // National ID — required. The only reliable backup lookup when no QR is present.
  national_id: nationalIdSchema,
});

export type MedicalProfileInput = z.infer<typeof medicalProfileSchema>;

/**
 * A doctor's edit to a patient's clinical fields, once the patient has
 * approved that doctor's care-access request. Deliberately narrower than
 * medicalProfileSchema — no identity/contact fields, matching the reduced
 * write scope in src/lib/care-edit.ts.
 */
export const clinicalEditSchema = z.object({
  allergies: optionalText,
  medications: optionalText,
  medical_conditions: optionalText,
  additional_notes: optionalText,
});

/** Auth schemas. */
export const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
});

export const signupSchema = credentialsSchema.extend({
  full_name: z.string().trim().min(1, "Tell us your name").max(120),
});

export type Credentials = z.infer<typeof credentialsSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

// ── Phase 2 schemas ──────────────────────────────────────────────────────

/**
 * Practitioner types a registering provider can choose, mapped to their
 * Nigerian licensing council (doctors: MDCN, nurses/midwives: NMCN).
 */
export const PRACTITIONER_TYPES = [
  { value: "doctor", label: "Doctor", council: "MDCN" },
  { value: "nurse", label: "Nurse / Midwife", council: "NMCN" },
] as const;

export const PRACTITIONER_TYPE_VALUES = PRACTITIONER_TYPES.map(
  (p) => p.value,
) as ["doctor", "nurse"];

export function councilFor(practitionerType: string): "MDCN" | "NMCN" {
  return practitionerType === "nurse" ? "NMCN" : "MDCN";
}

/** Practitioner registration: signup + a license number (doctor or nurse). */
export const doctorRegistrationSchema = signupSchema.extend({
  practitioner_type: z.enum(PRACTITIONER_TYPE_VALUES).optional(),
  license_number: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{4,32}$/, "Enter a valid license number"),
});
export type DoctorRegistrationInput = z.infer<typeof doctorRegistrationSchema>;

/** Facility types a registering institution can choose. */
export const FACILITY_TYPES = [
  { value: "hospital", label: "Hospital" },
  { value: "clinic", label: "Clinic" },
  { value: "diagnostic", label: "Diagnostic centre" },
  { value: "maternity", label: "Maternity home" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "other", label: "Other" },
] as const;

export const FACILITY_TYPE_VALUES = FACILITY_TYPES.map((f) => f.value) as [
  "hospital",
  "clinic",
  "diagnostic",
  "maternity",
  "pharmacy",
  "other",
];

/** Institution registration: signup + the facility's display name. */
export const institutionRegistrationSchema = signupSchema.extend({
  institution_name: z
    .string()
    .trim()
    .min(2, "Enter the facility's name")
    .max(160, "Please keep the name under 160 characters"),
});
export type InstitutionRegistrationInput = z.infer<
  typeof institutionRegistrationSchema
>;

/**
 * Facility verification details, modelled on Nigerian health-facility registries.
 * Each identifier is optional individually but the action requires at least one
 * registry number plus a document; formats match the real schemes.
 */
export const institutionVerificationSchema = z.object({
  name: z.string().trim().min(2, "Enter the facility's name").max(160),
  facility_type: z.enum(FACILITY_TYPE_VALUES),
  // National Health Facility Registry code (FMoH) — alphanumerics, dashes, slashes.
  nhfr_code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9/-]{3,40}$/, "Enter a valid NHFR code")
    .optional()
    .or(z.literal("")),
  // State Ministry of Health / HEFAMAA registration number.
  state_moh_reg_no: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9/-]{3,40}$/, "Enter a valid registration number")
    .optional()
    .or(z.literal("")),
  // Corporate Affairs Commission RC number (optional "RC" prefix).
  cac_rc_number: z
    .string()
    .trim()
    .regex(/^(RC)?\d{4,12}$/i, "Enter a valid CAC RC number")
    .optional()
    .or(z.literal("")),
  medical_director_name: optionalName,
  medical_director_mdcn: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{4,32}$/, "Enter a valid MDCN number")
    .optional()
    .or(z.literal("")),
});
export type InstitutionVerificationInput = z.infer<
  typeof institutionVerificationSchema
>;

/** Required free-text reason for any privileged admin record access. */
export const reasonSchema = z
  .string()
  .trim()
  .min(10, "Give a brief reason (at least 10 characters)")
  .max(500, "Please keep the reason under 500 characters");

/** Email a record to a recipient (referral / transfer). */
export const recordTransferSchema = z.object({
  recipient: z.string().trim().email("Enter a valid email address"),
  note: z
    .string()
    .trim()
    .max(500, "Please keep the note under 500 characters")
    .optional()
    .or(z.literal("")),
});

/** Allowed license document upload types and size (validated in the action). */
export const LICENSE_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;
export const LICENSE_FILE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
