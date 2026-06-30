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

const optionalText = z
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
  // National ID (backup lookup when no QR is present)
  national_id: z
    .string()
    .trim()
    .max(40, "Please keep this under 40 characters")
    .regex(/^[A-Za-z0-9-]*$/, "Use only letters, numbers, and dashes")
    .optional()
    .or(z.literal("")),
});

export type MedicalProfileInput = z.infer<typeof medicalProfileSchema>;

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

/** Doctor registration: signup + a license number. */
export const doctorRegistrationSchema = signupSchema.extend({
  license_number: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{4,32}$/, "Enter a valid license number"),
});
export type DoctorRegistrationInput = z.infer<typeof doctorRegistrationSchema>;

/** Required free-text reason for any privileged admin record access. */
export const reasonSchema = z
  .string()
  .trim()
  .min(10, "Give a brief reason (at least 10 characters)")
  .max(500, "Please keep the reason under 500 characters");

/** National ID, used both for saving and for the doctor lookup. */
export const nationalIdSchema = z
  .string()
  .trim()
  .min(5, "Enter a valid national ID")
  .max(40, "Enter a valid national ID")
  .regex(/^[A-Za-z0-9-]+$/, "Use only letters, numbers, and dashes");

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
