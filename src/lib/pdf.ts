import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { EmergencyView } from "@/lib/emergency";

/**
 * Render a patient record to a one-page PDF (BUILD_SPEC Phase 2).
 *
 * Uses pdf-lib (pure JS) so it runs reliably in the Next server/Node runtime
 * with no WASM/native deps. Mirrors the triage card's information order and the
 * teal "official document" aesthetic. Reuses the decrypted `EmergencyView`.
 */

const TEAL = rgb(0.06, 0.46, 0.43); // ~primary-700
const INK = rgb(0.1, 0.09, 0.08);
const MUTED = rgb(0.36, 0.33, 0.3);
const CRITICAL = rgb(0.78, 0.12, 0.12);

export interface RecordPdfInput {
  view: EmergencyView;
  qrPngDataUrl?: string;
  generatedFor: string; // who/what generated it, e.g. "Patient self-export"
}

export async function renderRecordPdf({
  view,
  qrPngDataUrl,
  generatedFor,
}: RecordPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const margin = 48;
  let y = height - 64;

  // Header band
  page.drawRectangle({ x: 0, y: height - 40, width, height: 40, color: TEAL });
  page.drawText("BEACON · EMERGENCY MEDICAL ID", {
    x: margin,
    y: height - 26,
    size: 11,
    font: bold,
    color: rgb(1, 1, 1),
  });

  // Patient name
  if (view.patient_name) {
    page.drawText(view.patient_name, { x: margin, y, size: 22, font: bold, color: INK });
    y -= 30;
  }

  const label = (text: string) => {
    page.drawText(text.toUpperCase(), { x: margin, y, size: 8, font: bold, color: MUTED });
    y -= 13;
  };
  const value = (text: string, color = INK, size = 12) => {
    for (const line of wrap(text || "—", font, size, width - margin * 2)) {
      page.drawText(line, { x: margin, y, size, font, color });
      y -= size + 4;
    }
    y -= 6;
  };

  // Allergies (loudest)
  label("Allergies");
  value(view.allergies || "No known allergies on file", view.allergies ? CRITICAL : MUTED, 14);

  // Blood group + age + sex + organ donor on one band
  label("Blood group");
  value(view.blood_group === "unknown" ? "—" : view.blood_group, INK, 18);

  label("Date of birth / Sex / Organ donor");
  value(
    `${view.date_of_birth ?? "—"}   ·   ${view.sex ?? "—"}   ·   ${
      view.organ_donor === true ? "Donor" : view.organ_donor === false ? "Not a donor" : "—"
    }`,
  );

  label("Current medications");
  value(view.medications || "None on file");

  label("Medical conditions");
  value(view.medical_conditions || "None on file");

  if (view.additional_notes.trim()) {
    label("Other notes");
    value(view.additional_notes);
  }

  label("Emergency contacts");
  value(contactLine(view.emergency_contact));
  if (view.emergency_contact_2.name || view.emergency_contact_2.phone) {
    value(contactLine(view.emergency_contact_2));
  }

  if (view.primary_physician.name || view.primary_physician.phone) {
    label("Primary doctor");
    value(
      [view.primary_physician.name, view.primary_physician.phone].filter(Boolean).join(" · "),
    );
  }

  // QR (top-right)
  if (qrPngDataUrl) {
    try {
      const png = await doc.embedPng(qrPngDataUrl);
      const size = 96;
      page.drawImage(png, { x: width - margin - size, y: height - 64 - size + 18, width: size, height: size });
    } catch {
      // ignore embed failure
    }
  }

  // Footer
  page.drawText(
    `Generated ${new Date().toLocaleString()} · ${generatedFor} · Beacon`,
    { x: margin, y: 36, size: 8, font, color: MUTED },
  );

  return doc.save();
}

function contactLine(c: { name: string | null; phone: string | null; relationship: string | null }): string {
  if (!c.name && !c.phone) return "None on file";
  const who = [c.name, c.relationship ? `(${c.relationship})` : null].filter(Boolean).join(" ");
  return [who, c.phone].filter(Boolean).join(" · ");
}

/** Greedy word-wrap to fit a max pixel width. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}
