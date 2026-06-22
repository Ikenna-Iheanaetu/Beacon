/**
 * Minimal typed surface for the Beacon schema (BUILD_SPEC §4).
 *
 * Hand-written so the app is fully typed before a live Supabase project exists.
 * Once a project is provisioned you can regenerate the canonical version with:
 *   supabase gen types typescript --project-id <id> > src/lib/database.types.ts
 */

export type UserRole = "patient" | "provider";
export type ProviderStatus = "none" | "pending" | "approved";
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
};

export type AccessLogRow = {
  id: string;
  accessor_id: string;
  patient_id: string;
  access_type: string;
  created_at: string;
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
        Insert: Omit<AccessLogRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AccessLogRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      provider_status: ProviderStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
