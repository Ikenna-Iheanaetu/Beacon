/**
 * Minimal typed surface for the Beacon schema (BUILD_SPEC §4).
 *
 * Hand-written so the app is fully typed before a live Supabase project exists.
 * Once a project is provisioned you can regenerate the canonical version with:
 *   supabase gen types typescript --project-id <id> > src/lib/database.types.ts
 */

export type UserRole = "patient" | "provider" | "admin" | "institution";
export type ProviderStatus = "none" | "pending" | "approved";
export type VerificationStatus = "pending" | "verified" | "rejected";
export type MembershipStatus = "pending" | "approved" | "rejected";
export type PractitionerType = "doctor" | "nurse";
export type Council = "MDCN" | "NMCN";
export type FacilityType =
  | "hospital"
  | "clinic"
  | "diagnostic"
  | "maternity"
  | "pharmacy"
  | "other";
export type AdminActionType =
  | "record_view"
  | "pdf_export"
  | "email_send"
  | "provider_approve"
  | "provider_reject"
  | "institution_approve"
  | "institution_reject";
export type Sex =
  | "female"
  | "male"
  | "intersex"
  | "prefer_not_to_say"
  | "unknown";
export type BloodGroup =
  | "A+"
  | "A-"
  | "B+"
  | "B-"
  | "AB+"
  | "AB-"
  | "O+"
  | "O-"
  | "unknown";

// NOTE: these MUST be `type` aliases, not `interface`s. supabase-js's
// GenericSchema constrains each table's Row to `Record<string, unknown>`, and
// an `interface` is not assignable to that (it has no implicit index
// signature) — which silently makes every query result `never`. Object type
// aliases are assignable, so the Database type is accepted and queries are typed.
export type ProfileRow = {
  id: string;
  role: UserRole;
  provider_status: ProviderStatus;
  full_name: string | null;
  created_at: string;
};

export type MedicalProfileRow = {
  id: string;
  user_id: string;
  blood_group: BloodGroup;
  allergies: string | null;
  medications: string | null;
  medical_conditions: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  qr_token: string;
  updated_at: string;
  // 0002_extend
  emergency_access_enabled: boolean;
  date_of_birth: string | null;
  sex: Sex | null;
  organ_donor: boolean | null;
  additional_notes: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_2_name: string | null;
  emergency_contact_2_phone: string | null;
  emergency_contact_2_relationship: string | null;
  primary_physician_name: string | null;
  primary_physician_phone: string | null;
  // 0004_verification_audit
  national_id: string | null;       // AES-encrypted (display)
  national_id_hash: string | null;  // keyed HMAC for exact lookup
  // 0010_public_emergency_access
  current_hospital_name: string | null;
};

export type AccessLogRow = {
  id: string;
  accessor_id: string | null; // null for an anonymous (no-login) scan
  patient_id: string;
  access_type: string; // 'emergency_view' | 'admin_review' | 'national_id_lookup'
  created_at: string;
  accessor_name: string | null;
  accessor_email: string | null;
  note: string | null;
};

export type ProviderVerificationRow = {
  id: string;
  provider_id: string;
  license_number: string;
  license_document_path: string | null;
  status: VerificationStatus;
  verify_check_result: unknown | null;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  practitioner_type: PractitionerType;
  council: Council;
};

export type AdminActionRow = {
  id: string;
  admin_id: string;
  action_type: AdminActionType;
  patient_id: string | null;
  reason: string | null;
  metadata: unknown | null;
  created_at: string;
};

export type InstitutionRow = {
  id: string;
  owner_id: string;
  name: string;
  facility_type: FacilityType;
  nhfr_code: string | null;
  state_moh_reg_no: string | null;
  cac_rc_number: string | null;
  medical_director_name: string | null;
  medical_director_mdcn: string | null;
  registration_document_path: string | null;
  status: VerificationStatus;
  verify_check_result: unknown | null;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InstitutionMemberRow = {
  id: string;
  institution_id: string;
  member_id: string;
  status: MembershipStatus;
  role_title: string | null;
  notes: string | null;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      medical_profiles: {
        Row: MedicalProfileRow;
        Insert: Partial<MedicalProfileRow> & { user_id: string };
        Update: Partial<MedicalProfileRow>;
        Relationships: [];
      };
      access_logs: {
        Row: AccessLogRow;
        Insert: Partial<AccessLogRow> & {
          patient_id: string;
          access_type: string;
        };
        Update: Partial<AccessLogRow>;
        Relationships: [];
      };
      provider_verifications: {
        Row: ProviderVerificationRow;
        Insert: Partial<ProviderVerificationRow> & {
          provider_id: string;
          license_number: string;
        };
        Update: Partial<ProviderVerificationRow>;
        Relationships: [];
      };
      admin_actions: {
        Row: AdminActionRow;
        Insert: Omit<AdminActionRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AdminActionRow>;
        Relationships: [];
      };
      institutions: {
        Row: InstitutionRow;
        Insert: Partial<InstitutionRow> & {
          owner_id: string;
          name: string;
        };
        Update: Partial<InstitutionRow>;
        Relationships: [];
      };
      institution_members: {
        Row: InstitutionMemberRow;
        Insert: Partial<InstitutionMemberRow> & {
          institution_id: string;
          member_id: string;
        };
        Update: Partial<InstitutionMemberRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      provider_status: ProviderStatus;
      admin_action_type: AdminActionType;
    };
    CompositeTypes: Record<string, never>;
  };
}
