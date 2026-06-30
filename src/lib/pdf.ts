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
  recordInfoGrid,
  recordMedicalColumns,
  recordNotes,
  recordContacts,
  CONFIDENTIALITY_NOTICE,
} from "@/lib/record-content";

/**
 * Render a patient record to a polished "health passport" PDF (Phase 2).
 *
 * Uses pdf-lib (pure JS) so it runs reliably in the Next server/Node runtime
 * with no WASM/native deps. Layout follows the ID-card mockup: a branded header
 * with QR, an identity info grid, a 3-column medical table, and a contacts
 * table. Content (labels, order, criticality) comes from `record-content.ts`
 * so the PDF and the Word export (`docx.ts`) stay in lockstep.
 */

// Palette mirrors the app's teal brand tokens (globals.css).
const TEAL_700 = rgb(0.059, 0.463, 0.431);
const TEAL_600 = rgb(0.051, 0.58, 0.533);
const TEAL_500 = rgb(0.078, 0.722, 0.651);
const INK = rgb(0.1, 0.09, 0.08);
const MUTED = rgb(0.42, 0.44, 0.44);
const FAINT = rgb(0.6, 0.62, 0.62);
const BORDER = rgb(0.87, 0.89, 0.89);
const CRIT = rgb(0.72, 0.11, 0.11);

const PAGE = { w: 595.28, h: 841.89 };
const MARGIN = 50;
const FOOTER_H = 50;
const CONTENT_W = PAGE.w - MARGIN * 2;

export interface RecordPdfInput {
  view: EmergencyView;
  qrPngDataUrl?: string;
  qrToken?: string;
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
  qrToken,
  generatedFor,
}: RecordPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const qrImage = qrPngDataUrl
    ? await doc.embedPng(qrPngDataUrl).catch(() => undefined)
    : undefined;

  const ctx: Ctx = { doc, page: doc.addPage([PAGE.w, PAGE.h]), font, bold, y: PAGE.h - MARGIN };

  drawHeader(ctx, qrImage);
  drawTitle(ctx);
  drawInfoGrid(ctx, recordInfoGrid(view, qrToken));
  drawMedical(ctx, recordMedicalColumns(view));

  const notes = recordNotes(view);
  if (notes) {
    drawSectionHeading(ctx, "Additional Notes");
    drawParagraph(ctx, notes);
    ctx.y -= 6;
  }

  drawSectionHeading(ctx, "Emergency Contact");
  drawContacts(ctx, recordContacts(view));

  drawFooterAll(doc, font, bold, generatedFor);
  return doc.save();
}

/** Branded header: teal wordmark + subtitle on the left, QR on the right. */
function drawHeader(ctx: Ctx, qr?: Awaited<ReturnType<PDFDocument["embedPng"]>>) {
  const { page } = ctx;
  const topY = ctx.y;

  // Logo mark — a rounded teal square with a "+" cross.
  const m = 22;
  page.drawRectangle({ x: MARGIN, y: topY - m, width: m, height: m, color: TEAL_600 });
  page.drawText("+", { x: MARGIN + 6, y: topY - m + 4, size: 16, font: ctx.bold, color: rgb(1, 1, 1) });

  page.drawText("Beacon", { x: MARGIN + m + 10, y: topY - 16, size: 18, font: ctx.bold, color: TEAL_700 });
  page.drawText("DIGITAL HEALTH PASSPORT", {
    x: MARGIN + m + 11,
    y: topY - 28,
    size: 6.5,
    font: ctx.bold,
    color: FAINT,
  });

  if (qr) {
    const size = 70;
    page.drawImage(qr, { x: PAGE.w - MARGIN - size, y: topY - size + 6, width: size, height: size });
  }

  ctx.y = topY - 78;
  page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE.w - MARGIN, y: ctx.y },
    thickness: 1,
    color: BORDER,
  });
  ctx.y -= 26;
}

function drawTitle(ctx: Ctx) {
  const { page } = ctx;
  page.drawText("Health Passport", { x: MARGIN, y: ctx.y, size: 22, font: ctx.bold, color: INK });
  ctx.y -= 16;
  page.drawText("Personal Health Summary", { x: MARGIN, y: ctx.y, size: 10, font: ctx.font, color: MUTED });
  ctx.y -= 26;
}

/** Two-column key/value identity grid. */
function drawInfoGrid(ctx: Ctx, fields: { label: string; value: string }[]) {
  const { page } = ctx;
  const colW = CONTENT_W / 2;
  const rowH = 34;
  const startY = ctx.y;

  fields.forEach((f, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * colW;
    const y = startY - row * rowH;
    page.drawText(f.label.toUpperCase(), { x, y, size: 7, font: ctx.bold, color: FAINT });
    page.drawText(fit(f.value, ctx.bold, 12, colW - 16), {
      x,
      y: y - 14,
      size: 12,
      font: ctx.bold,
      color: INK,
    });
  });

  const rows = Math.ceil(fields.length / 2);
  ctx.y = startY - rows * rowH - 4;
}

/** Three-column medical table: Allergies / Medications / Conditions. */
function drawMedical(
  ctx: Ctx,
  columns: { heading: string; items: string[]; empty: boolean; critical?: boolean }[],
) {
  drawSectionHeading(ctx, "Medical Information");
  const { page } = ctx;
  const gap = 16;
  const colW = (CONTENT_W - gap * (columns.length - 1)) / columns.length;
  const startY = ctx.y;
  let lowest = startY;

  columns.forEach((c, i) => {
    const x = MARGIN + i * (colW + gap);
    let y = startY;
    const head = c.critical ? CRIT : TEAL_700;
    page.drawText(c.heading.toUpperCase(), { x, y, size: 8, font: ctx.bold, color: head });
    y -= 6;
    page.drawLine({ start: { x, y }, end: { x: x + colW, y }, thickness: 0.75, color: BORDER });
    y -= 15;
    const itemColor = c.empty ? MUTED : c.critical ? CRIT : INK;
    for (const item of c.items) {
      for (const [j, line] of wrap(`•  ${item}`, ctx.font, 10, colW).entries()) {
        page.drawText(line, { x: j === 0 ? x : x + 9, y, size: 10, font: ctx.font, color: itemColor });
        y -= 14;
      }
    }
    lowest = Math.min(lowest, y);
  });

  ctx.y = lowest - 10;
}

/** Name / Phone contacts table with a header row. */
function drawContacts(ctx: Ctx, rows: { label: string; name: string; phone: string }[]) {
  const { page } = ctx;
  const nameW = CONTENT_W * 0.62;
  let y = ctx.y;

  page.drawText("NAME", { x: MARGIN, y, size: 7, font: ctx.bold, color: FAINT });
  page.drawText("PHONE", { x: MARGIN + nameW, y, size: 7, font: ctx.bold, color: FAINT });
  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.w - MARGIN, y }, thickness: 0.75, color: BORDER });
  y -= 16;

  for (const r of rows) {
    page.drawText(fit(r.name, ctx.bold, 11, nameW - 10), { x: MARGIN, y, size: 11, font: ctx.bold, color: INK });
    page.drawText(r.phone, { x: MARGIN + nameW, y, size: 11, font: ctx.font, color: INK });
    y -= 12;
    page.drawText(r.label, { x: MARGIN, y, size: 8, font: ctx.font, color: MUTED });
    y -= 18;
  }
  ctx.y = y;
}

function drawSectionHeading(ctx: Ctx, text: string) {
  ensureSpace(ctx, 60);
  const { page } = ctx;
  page.drawRectangle({ x: MARGIN, y: ctx.y - 1, width: 16, height: 3, color: TEAL_500 });
  page.drawText(text, { x: MARGIN + 24, y: ctx.y - 3, size: 11, font: ctx.bold, color: INK });
  ctx.y -= 22;
}

function drawParagraph(ctx: Ctx, text: string) {
  const { page } = ctx;
  for (const line of wrap(text, ctx.font, 10.5, CONTENT_W)) {
    ensureSpace(ctx, 16);
    page.drawText(line, { x: MARGIN, y: ctx.y, size: 10.5, font: ctx.font, color: INK });
    ctx.y -= 15;
  }
}

/** Add a fresh page (with a slim top accent) if the cursor is too low. */
function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed > FOOTER_H + 12) return;
  ctx.page = ctx.doc.addPage([PAGE.w, PAGE.h]);
  ctx.page.drawRectangle({ x: 0, y: PAGE.h - 4, width: PAGE.w, height: 4, color: TEAL_500 });
  ctx.y = PAGE.h - MARGIN;
}

/** Centered confidentiality footer + page frame on every page. */
function drawFooterAll(doc: PDFDocument, font: PDFFont, bold: PDFFont, generatedFor: string) {
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    page.drawLine({
      start: { x: MARGIN, y: FOOTER_H + 6 },
      end: { x: PAGE.w - MARGIN, y: FOOTER_H + 6 },
      thickness: 0.75,
      color: BORDER,
    });
    centered(page, CONFIDENTIALITY_NOTICE, font, 7.5, FOOTER_H - 8, FAINT);
    const stamp = `Generated by ${generatedFor} · ${new Date().toLocaleString()}`;
    centered(page, stamp, font, 7, FOOTER_H - 20, MUTED);
    const num = `Page ${i + 1} of ${pages.length}`;
    page.drawText(num, {
      x: PAGE.w - MARGIN - bold.widthOfTextAtSize(num, 7),
      y: 14,
      size: 7,
      font: bold,
      color: FAINT,
    });
  });
}

function centered(page: PDFPage, text: string, font: PDFFont, size: number, y: number, color: RGB) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (PAGE.w - w) / 2, y, size, font, color });
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
