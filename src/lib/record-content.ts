import "server-only";
import type { EmergencyView } from "@/lib/emergency";

/**
 * Single source of truth for the *content* of an exported record, shared by the
 * PDF (`pdf.ts`) and Word (`docx.ts`) renderers so both stay in lockstep. Only
 * the presentation layer differs between formats — the labels, order, and
 * "criticality" of each field live here. Layout follows an ID-card style:
 * an info grid up top, a 3-column medical table, then contacts.
 */

export interface InfoField {
  label: string;
  value: string;
}

export interface MedicalColumn {
  heading: string;
  items: string[];
  empty: boolean;
  critical?: boolean;
}

export interface ContactRow {
  label: string;
  name: string;
  phone: string;
}

/** A short, human-presentable record reference derived from the QR token. */
export function recordId(qrToken?: string): string {
  if (!qrToken) return "BEACON-RECORD";
  return `BEACON-${qrToken.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/** The top "ID card" grid: who, when, and the two facts that matter most. */
export function recordInfoGrid(
  view: EmergencyView,
  qrToken?: string,
): InfoField[] {
  const { bloodGroup } = recordCritical(view);
  return [
    { label: "Patient ID", value: recordId(qrToken) },
    { label: "Full Name", value: view.patient_name || "Beacon patient" },
    { label: "Date of Birth", value: view.date_of_birth || "—" },
    { label: "Gender", value: formatSex(view.sex) },
    { label: "Blood Group", value: bloodGroup },
    {
      label: "Generated On",
      value: new Date().toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
  ];
}

function formatSex(sex: EmergencyView["sex"]): string {
  if (!sex) return "—";
  return sex.charAt(0).toUpperCase() + sex.slice(1);
}

/** Blood group + whether allergies are present (drives red emphasis). */
export function recordCritical(view: EmergencyView): {
  bloodGroup: string;
  hasAllergies: boolean;
} {
  return {
    bloodGroup:
      !view.blood_group || view.blood_group === "unknown"
        ? "Unknown"
        : view.blood_group,
    hasAllergies: Boolean(view.allergies?.trim()),
  };
}

/** Split a free-text field into bullet items (newline-, then comma-, separated). */
function bulletize(text: string | null | undefined): string[] {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return [];
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const parts = lines.length > 1 ? lines : trimmed.split(/,\s*/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** The 3-column medical table: Allergies / Medications / Conditions. */
export function recordMedicalColumns(view: EmergencyView): MedicalColumn[] {
  const allergies = bulletize(view.allergies);
  const medications = bulletize(view.medications);
  const conditions = bulletize(view.medical_conditions);
  return [
    {
      heading: "Allergies",
      items: allergies.length ? allergies : ["None on file"],
      empty: allergies.length === 0,
      critical: allergies.length > 0,
    },
    {
      heading: "Medications",
      items: medications.length ? medications : ["None on file"],
      empty: medications.length === 0,
    },
    {
      heading: "Conditions",
      items: conditions.length ? conditions : ["None on file"],
      empty: conditions.length === 0,
    },
  ];
}

/** Notes section — only present when the patient has written something. */
export function recordNotes(view: EmergencyView): string | null {
  return view.additional_notes?.trim() || null;
}

/** Emergency contacts + primary physician, in display order. */
export function recordContacts(view: EmergencyView): ContactRow[] {
  const rows: ContactRow[] = [];
  const c1 = view.emergency_contact;
  if (c1.name || c1.phone) {
    rows.push({
      label: c1.relationship ? `Emergency contact (${c1.relationship})` : "Emergency contact",
      name: c1.name || "—",
      phone: c1.phone || "—",
    });
  }
  const c2 = view.emergency_contact_2;
  if (c2.name || c2.phone) {
    rows.push({
      label: c2.relationship ? `Second contact (${c2.relationship})` : "Second contact",
      name: c2.name || "—",
      phone: c2.phone || "—",
    });
  }
  if (view.primary_physician.name || view.primary_physician.phone) {
    rows.push({
      label: "Primary doctor",
      name: view.primary_physician.name || "—",
      phone: view.primary_physician.phone || "—",
    });
  }
  if (rows.length === 0) {
    rows.push({ label: "Emergency contact", name: "None on file", phone: "—" });
  }
  return rows;
}

/** Confidentiality line shown in the footer of every export. */
export const CONFIDENTIALITY_NOTICE =
  "This document is digitally generated and encrypted. Present this QR code in an emergency to access your health information.";
