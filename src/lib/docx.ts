import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  Footer,
  ImageRun,
  VerticalAlign,
} from "docx";
import type { EmergencyView } from "@/lib/emergency";
import {
  recordInfoGrid,
  recordMedicalColumns,
  recordNotes,
  recordContacts,
  CONFIDENTIALITY_NOTICE,
  type InfoField,
  type MedicalColumn,
  type ContactRow,
} from "@/lib/record-content";

/**
 * Render a patient record to a Word (.docx) document — the editable companion
 * to the PDF (`pdf.ts`). Content (labels, order, criticality) is shared via
 * `record-content.ts` so the two formats never drift apart. Layout mirrors the
 * PDF's "health passport" ID-card design using Word-native tables and borders.
 */

// Hex colours (no leading #) matching the teal brand tokens.
const TEAL_700 = "0F766E";
const TEAL_600 = "0D9488";
const TEAL_500 = "14B8A6";
const INK = "1A1714";
const MUTED = "6B7280";
const FAINT = "9CA3AF";
const BORDER = "DDE2E1";
const WHITE = "FFFFFF";
const CRIT = "B71C1C";

const FULL = { size: 100, type: WidthType.PERCENTAGE } as const;
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
};

export interface RecordDocxInput {
  view: EmergencyView;
  generatedFor: string;
  qrPngDataUrl?: string;
  qrToken?: string;
}

export async function renderRecordDocx({
  view,
  generatedFor,
  qrPngDataUrl,
  qrToken,
}: RecordDocxInput): Promise<Uint8Array> {
  const body: (Paragraph | Table)[] = [
    headerBand(qrPngDataUrl),
    divider(),
    new Paragraph({
      spacing: { before: 160, after: 10 },
      children: [new TextRun({ text: "Health Passport", bold: true, size: 36, color: INK })],
    }),
    new Paragraph({
      spacing: { after: 220 },
      children: [new TextRun({ text: "Personal Health Summary", size: 18, color: MUTED })],
    }),
    infoGrid(recordInfoGrid(view, qrToken)),
    new Paragraph({ spacing: { after: 160 } }),
    sectionHeading("Medical Information"),
    medicalTable(recordMedicalColumns(view)),
  ];

  const notes = recordNotes(view);
  if (notes) {
    body.push(sectionHeading("Additional Notes"));
    body.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: notes, size: 21, color: INK })],
      }),
    );
  }

  body.push(sectionHeading("Emergency Contact"));
  body.push(contactsTable(recordContacts(view)));

  const doc = new Document({
    creator: "Beacon",
    title: "Beacon Health Passport",
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        footers: { default: pageFooter(generatedFor) },
        children: body,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

/** Branded header: logo + wordmark on the left, QR on the right. */
function headerBand(qrPngDataUrl?: string): Table {
  const qr = qrImage(qrPngDataUrl);

  const brandCell = new TableCell({
    width: { size: 70, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { after: 0 },
        children: [
          new TextRun({ text: "✚ ", bold: true, size: 28, color: TEAL_600 }),
          new TextRun({ text: "Beacon", bold: true, size: 32, color: TEAL_700 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "DIGITAL HEALTH PASSPORT",
            bold: true,
            size: 13,
            color: FAINT,
            characterSpacing: 24,
          }),
        ],
      }),
    ],
  });

  const qrCell = new TableCell({
    width: { size: 30, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({ alignment: AlignmentType.RIGHT, children: qr ? [qr] : [] }),
    ],
  });

  return new Table({
    width: FULL,
    borders: NO_BORDERS,
    columnWidths: [6700, 2900],
    rows: [new TableRow({ children: [brandCell, qrCell] })],
  });
}

/** Decode the QR data URL into a docx ImageRun. */
function qrImage(qrPngDataUrl?: string): ImageRun | null {
  if (!qrPngDataUrl) return null;
  const base64 = qrPngDataUrl.split(",")[1];
  if (!base64) return null;
  try {
    const data = Uint8Array.from(Buffer.from(base64, "base64"));
    return new ImageRun({ data, type: "png", transformation: { width: 88, height: 88 } });
  } catch {
    return null;
  }
}

/** Two-column key/value identity grid. */
function infoGrid(fields: InfoField[]): Table {
  const rows: TableRow[] = [];
  for (let i = 0; i < fields.length; i += 2) {
    rows.push(
      new TableRow({
        children: [infoCell(fields[i]), infoCell(fields[i + 1])],
      }),
    );
  }
  return new Table({ width: FULL, borders: NO_BORDERS, columnWidths: [4800, 4800], rows });
}

function infoCell(field?: InfoField): TableCell {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    margins: { top: 60, bottom: 120, left: 0, right: 160 },
    children: field
      ? [
          new Paragraph({
            spacing: { after: 10 },
            children: [
              new TextRun({
                text: field.label.toUpperCase(),
                bold: true,
                size: 13,
                color: FAINT,
                characterSpacing: 16,
              }),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: field.value, bold: true, size: 22, color: INK })],
          }),
        ]
      : [new Paragraph({})],
  });
}

/** Three-column medical table: Allergies / Medications / Conditions. */
function medicalTable(columns: MedicalColumn[]): Table {
  const cells = columns.map((c) => {
    const head = c.critical ? CRIT : TEAL_700;
    const itemColor = c.empty ? MUTED : c.critical ? CRIT : INK;
    return new TableCell({
      width: { size: Math.floor(100 / columns.length), type: WidthType.PERCENTAGE },
      margins: { top: 80, bottom: 80, left: 60, right: 120 },
      borders: {
        ...NO_BORDERS,
        bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER },
      },
      children: [
        new Paragraph({
          spacing: { after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 3 } },
          children: [
            new TextRun({
              text: c.heading.toUpperCase(),
              bold: true,
              size: 15,
              color: head,
              characterSpacing: 16,
            }),
          ],
        }),
        ...c.items.map(
          (item) =>
            new Paragraph({
              spacing: { after: 40 },
              bullet: { level: 0 },
              children: [new TextRun({ text: item, size: 20, color: itemColor })],
            }),
        ),
      ],
    });
  });

  return new Table({
    width: FULL,
    borders: NO_BORDERS,
    rows: [new TableRow({ children: cells })],
  });
}

/** Name / Phone contacts table with a shaded header row. */
function contactsTable(rows: ContactRow[]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: ["NAME", "PHONE"].map(
      (h) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: "F4F6F6", color: "auto" },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          borders: cellBorders(),
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: h, bold: true, size: 14, color: FAINT, characterSpacing: 16 }),
              ],
            }),
          ],
        }),
    ),
  });

  const dataRows = rows.map(
    (r) =>
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: cellBorders(),
            children: [
              new Paragraph({
                children: [new TextRun({ text: r.name, bold: true, size: 21, color: INK })],
              }),
              new Paragraph({
                children: [new TextRun({ text: r.label, size: 16, color: MUTED })],
              }),
            ],
          }),
          new TableCell({
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            verticalAlign: VerticalAlign.CENTER,
            borders: cellBorders(),
            children: [
              new Paragraph({
                children: [new TextRun({ text: r.phone, size: 21, color: INK })],
              }),
            ],
          }),
        ],
      }),
  );

  return new Table({
    width: FULL,
    columnWidths: [6000, 3600],
    rows: [headerRow, ...dataRows],
  });
}

function cellBorders() {
  const b = { style: BorderStyle.SINGLE, size: 4, color: BORDER } as const;
  return { top: b, bottom: b, left: b, right: b };
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL_500, space: 6 } },
    children: [new TextRun({ text, bold: true, size: 22, color: INK })],
  });
}

function divider(): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER, space: 1 } },
    children: [],
  });
}

function pageFooter(generatedFor: string): Footer {
  const stamp = `Generated by ${generatedFor}  ·  ${new Date().toLocaleString()}`;
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: BORDER, space: 6 } },
        spacing: { before: 80, after: 30 },
        children: [new TextRun({ text: CONFIDENTIALITY_NOTICE, size: 14, color: FAINT })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: stamp, size: 13, color: MUTED })],
      }),
    ],
  });
}
