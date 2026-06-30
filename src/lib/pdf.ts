import "server-only";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import type { EmergencyView } from "@/lib/emergency";
import {
  recordIdentity,
  recordCritical,
  recordSections,
  CONFIDENTIALITY_NOTICE,
} from "@/lib/record-content";

/**
 * Render a patient record to a polished, "official document" PDF (Phase 2).
 *
 * Uses pdf-lib (pure JS) so it runs reliably in the Next server/Node runtime
 * with no WASM/native deps. Content order/labels come from `record-content.ts`
 * so the PDF and the Word export stay in lockstep. The Word renderer lives in
 * `docx.ts`.
 */

// Palette mirrors the app's teal brand tokens (globals.css).
const TEAL_700 = rgb(0.059, 0.463, 0.431);
const TEAL_800 = rgb(0.067, 0.369, 0.349);
const TEAL_500 = rgb(0.078, 0.722, 0.651);
const TEAL_200 = rgb(0.6, 0.965, 0.894);
const TEAL_50 = rgb(0.941, 0.992, 0.98);
const INK = rgb(0.1, 0.09, 0.08);
const MUTED = rgb(0.42, 0.44, 0.44);
const FAINT = rgb(0.6, 0.62, 0.62);
const BORDER = rgb(0.87, 0.89, 0.89);
const WHITE = rgb(1, 1, 1);
const CRIT = rgb(0.72, 0.11, 0.11);
const CRIT_BG = rgb(0.992, 0.949, 0.949);
const CRIT_BORDER = rgb(0.949, 0.804, 0.804);

const PAGE = { w: 595.28, h: 841.89 };
const MARGIN = 48;
const HEADER_H = 104;
const FOOTER_H = 54;
const CONTENT_W = PAGE.w - MARGIN * 2;

export interface RecordPdfInput {
  view: EmergencyView;
  qrPngDataUrl?: string;
  generatedFor: string; // who/what generated it, e.g. "Patient self-export"
}

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
}

export async function renderRecordPdf({
  view,
  qrPngDataUrl,
  generatedFor,
}: RecordPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const qrImage = qrPngDataUrl
    ? await doc.embedPng(qrPngDataUrl).catch(() => undefined)
    : undefined;

  const ctx: Ctx = { doc, page: doc.addPage([PAGE.w, PAGE.h]), font, bold, y: 0 };
  drawHeader(ctx, qrImage);
  ctx.y = PAGE.h - HEADER_H - 34;

  // Identity
  const id = recordIdentity(view);
  ctx.page.drawText(fit(id.name, bold, 23, CONTENT_W - 130), {
    x: MARGIN,
    y: ctx.y,
    size: 23,
    font: bold,
    color: INK,
  });
  ctx.y -= 19;
  ctx.page.drawText(id.meta, { x: MARGIN, y: ctx.y, size: 10.5, font, color: MUTED });
  ctx.y -= 26;

  // Critical row: blood group + allergies, side by side.
  drawCriticalRow(ctx, view);
  ctx.y -= 22;

  // Body sections.
  for (const section of recordSections(view)) {
    ensureSpace(ctx, 60);
    drawSectionHeading(ctx, section.heading);
    for (const field of section.fields) {
      drawField(ctx, field);
    }
    ctx.y -= 8;
  }

  drawFooterAll(doc, font, bold, generatedFor);
  return doc.save();
}

/** Teal header band with wordmark, subtitle, and the QR on a white card. */
function drawHeader(ctx: Ctx, qr?: Awaited<ReturnType<PDFDocument["embedPng"]>>) {
  const { page } = ctx;
  const top = PAGE.h - HEADER_H;
  page.drawRectangle({ x: 0, y: top, width: PAGE.w, height: HEADER_H, color: TEAL_700 });
  // Deeper band along the bottom edge + a bright accent rule for depth.
  page.drawRectangle({ x: 0, y: top, width: PAGE.w, height: 26, color: TEAL_800 });
  page.drawRectangle({ x: 0, y: top, width: PAGE.w, height: 3, color: TEAL_500 });

  page.drawText("BEACON", {
    x: MARGIN,
    y: PAGE.h - 50,
    size: 26,
    font: ctx.bold,
    color: WHITE,
  });
  page.drawText("EMERGENCY MEDICAL RECORD", {
    x: MARGIN + 2,
    y: PAGE.h - 66,
    size: 9,
    font: ctx.bold,
    color: TEAL_200,
  });
  page.drawText("Digital Health Passport", {
    x: MARGIN + 2,
    y: PAGE.h - 88,
    size: 8,
    font: ctx.font,
    color: TEAL_200,
  });

  if (qr) {
    const size = 64;
    const pad = 6;
    const cardX = PAGE.w - MARGIN - size - pad * 2;
    const cardY = PAGE.h - 24 - size - pad * 2;
    page.drawRectangle({
      x: cardX,
      y: cardY,
      width: size + pad * 2,
      height: size + pad * 2,
      color: WHITE,
    });
    page.drawImage(qr, { x: cardX + pad, y: cardY + pad, width: size, height: size });
    page.drawText("SCAN", {
      x: cardX + (size + pad * 2 - ctx.bold.widthOfTextAtSize("SCAN", 7)) / 2,
      y: cardY - 11,
      size: 7,
      font: ctx.bold,
      color: TEAL_200,
    });
  }
}

/** Two emphasis cards: blood group (teal) and allergies (red when present). */
function drawCriticalRow(ctx: Ctx, view: EmergencyView) {
  const { page } = ctx;
  const { bloodGroup, allergies } = recordCritical(view);
  const gap = 14;
  const bloodW = 150;
  const allergyW = CONTENT_W - bloodW - gap;
  const cardH = 66;
  const topY = ctx.y - cardH;

  // Blood group card.
  card(page, MARGIN, topY, bloodW, cardH, TEAL_50, TEAL_200);
  page.drawText("BLOOD GROUP", { x: MARGIN + 14, y: ctx.y - 20, size: 8, font: ctx.bold, color: TEAL_700 });
  page.drawText(bloodGroup, { x: MARGIN + 14, y: ctx.y - 50, size: 26, font: ctx.bold, color: TEAL_800 });

  // Allergies card.
  const ax = MARGIN + bloodW + gap;
  const crit = allergies.critical;
  card(page, ax, topY, allergyW, cardH, crit ? CRIT_BG : TEAL_50, crit ? CRIT_BORDER : BORDER);
  page.drawText("ALLERGIES", {
    x: ax + 14,
    y: ctx.y - 20,
    size: 8,
    font: ctx.bold,
    color: crit ? CRIT : MUTED,
  });
  const valColor = crit ? CRIT : MUTED;
  let ay = ctx.y - 36;
  const lines = wrap(allergies.value, ctx.bold, 13, allergyW - 28).slice(0, 2);
  for (const line of lines) {
    page.drawText(line, { x: ax + 14, y: ay, size: 13, font: ctx.bold, color: valColor });
    ay -= 16;
  }

  ctx.y = topY;
}

function drawSectionHeading(ctx: Ctx, text: string) {
  const { page } = ctx;
  page.drawRectangle({ x: MARGIN, y: ctx.y - 1, width: 18, height: 3, color: TEAL_500 });
  page.drawText(text.toUpperCase(), {
    x: MARGIN + 26,
    y: ctx.y - 3,
    size: 9,
    font: ctx.bold,
    color: TEAL_700,
  });
  ctx.y -= 8;
  page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE.w - MARGIN, y: ctx.y },
    thickness: 0.75,
    color: BORDER,
  });
  ctx.y -= 16;
}

function drawField(ctx: Ctx, field: { label: string; value: string; empty?: boolean }) {
  const { page } = ctx;
  ensureSpace(ctx, 36);
  page.drawText(field.label.toUpperCase(), {
    x: MARGIN,
    y: ctx.y,
    size: 7.5,
    font: ctx.bold,
    color: FAINT,
  });
  ctx.y -= 13;
  const color = field.empty ? MUTED : INK;
  for (const line of wrap(field.value || "—", ctx.font, 11, CONTENT_W)) {
    ensureSpace(ctx, 16);
    page.drawText(line, { x: MARGIN, y: ctx.y, size: 11, font: ctx.font, color });
    ctx.y -= 15;
  }
  ctx.y -= 6;
}

/** Filled, bordered rectangle used for the emphasis cards. */
function card(page: PDFPage, x: number, y: number, w: number, h: number, fill: RGB, border: RGB) {
  page.drawRectangle({ x, y, width: w, height: h, color: fill, borderColor: border, borderWidth: 1 });
}

/** Add a fresh page (with a slim top accent) if the cursor is too low. */
function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed > FOOTER_H + 12) return;
  ctx.page = ctx.doc.addPage([PAGE.w, PAGE.h]);
  ctx.page.drawRectangle({ x: 0, y: PAGE.h - 4, width: PAGE.w, height: 4, color: TEAL_500 });
  ctx.y = PAGE.h - 40;
}

/** Footer + page frame drawn on every page after layout is complete. */
function drawFooterAll(doc: PDFDocument, font: PDFFont, bold: PDFFont, generatedFor: string) {
  const pages = doc.getPages();
  const stamp = `Generated ${new Date().toLocaleString()}  ·  ${generatedFor}`;
  pages.forEach((page, i) => {
    page.drawLine({
      start: { x: MARGIN, y: FOOTER_H + 8 },
      end: { x: PAGE.w - MARGIN, y: FOOTER_H + 8 },
      thickness: 0.75,
      color: BORDER,
    });
    for (const [j, line] of wrap(CONFIDENTIALITY_NOTICE, font, 7.5, CONTENT_W - 80).entries()) {
      page.drawText(line, { x: MARGIN, y: FOOTER_H - 6 - j * 10, size: 7.5, font, color: FAINT });
    }
    page.drawText(stamp, { x: MARGIN, y: 16, size: 7.5, font, color: MUTED });
    const num = `Page ${i + 1} of ${pages.length}`;
    page.drawText(num, {
      x: PAGE.w - MARGIN - bold.widthOfTextAtSize(num, 7.5),
      y: 16,
      size: 7.5,
      font: bold,
      color: TEAL_700,
    });
  });
}

/** Truncate a single line to fit a max width, adding an ellipsis. */
function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}…`, size) > maxWidth) {
    s = s.slice(0, -1);
  }
  return `${s.trimEnd()}…`;
}

/** Greedy word-wrap to fit a max pixel width. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of (text || "—").split(/\r?\n/)) {
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
