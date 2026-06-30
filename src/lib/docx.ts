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
  Header,
  Footer,
  VerticalAlign,
} from "docx";
import type { EmergencyView } from "@/lib/emergency";
import {
  recordIdentity,
  recordCritical,
  recordSections,
  CONFIDENTIALITY_NOTICE,
  type RecordField,
} from "@/lib/record-content";

/**
 * Render a patient record to a Word (.docx) document — the editable companion
 * to the PDF (`pdf.ts`). Content (labels, order, criticality) is shared via
 * `record-content.ts` so the two formats never drift apart. The styling mirrors
 * the PDF's teal "official document" aesthetic using Word-native tables,
 * shading, and borders.
 */

// Hex colours (no leading #) matching the teal brand tokens.
const TEAL_700 = "0F766E";
const TEAL_800 = "115E59";
const TEAL_50 = "F0FDFA";
const TEAL_200 = "99F6E4";
const INK = "1A1714";
const MUTED = "6B7280";
const FAINT = "9CA3AF";
const BORDER = "DDE2E1";
const WHITE = "FFFFFF";
const CRIT = "B71C1C";
const CRIT_BG = "FDF2F2";
const CRIT_BORDER = "F2CDCD";

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
}

export async function renderRecordDocx({
  view,
  generatedFor,
}: RecordDocxInput): Promise<Uint8Array> {
  const id = recordIdentity(view);

  const body: (Paragraph | Table)[] = [
    // Patient identity
    new Paragraph({
      spacing: { before: 200, after: 20 },
      children: [new TextRun({ text: id.name, bold: true, size: 40, color: INK })],
    }),
    new Paragraph({
      spacing: { after: 220 },
      children: [new TextRun({ text: id.meta, size: 19, color: MUTED })],
    }),
    criticalRow(view),
    new Paragraph({ spacing: { after: 120 } }),
  ];

  for (const section of recordSections(view)) {
    body.push(sectionHeading(section.heading));
    for (const field of section.fields) body.push(...fieldBlock(field));
  }

  const doc = new Document({
    creator: "Beacon",
    title: "Beacon Emergency Medical Record",
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        headers: { default: brandHeader() },
        footers: { default: pageFooter(generatedFor) },
        children: body,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

/** Teal full-width header band with the wordmark + subtitle. */
function brandHeader(): Header {
  return new Header({
    children: [
      new Table({
        width: FULL,
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { type: ShadingType.CLEAR, fill: TEAL_700, color: "auto" },
                margins: { top: 160, bottom: 160, left: 220, right: 220 },
                borders: {
                  ...NO_BORDERS,
                  bottom: { style: BorderStyle.SINGLE, size: 24, color: TEAL_800 },
                },
                children: [
                  new Paragraph({
                    spacing: { after: 0 },
                    children: [
                      new TextRun({ text: "BEACON", bold: true, size: 44, color: WHITE }),
                    ],
                  }),
                  new Paragraph({
                    spacing: { before: 20 },
                    children: [
                      new TextRun({
                        text: "EMERGENCY MEDICAL RECORD",
                        bold: true,
                        size: 16,
                        color: TEAL_200,
                        characterSpacing: 30,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ spacing: { after: 120 } }),
    ],
  });
}

/** Two emphasis cells: blood group (teal) and allergies (red when present). */
function criticalRow(view: EmergencyView): Table {
  const { bloodGroup, allergies } = recordCritical(view);
  const crit = Boolean(allergies.critical);

  const cell = (
    widthPct: number,
    fill: string,
    borderColor: string,
    label: string,
    labelColor: string,
    value: string,
    valueColor: string,
    valueSize: number,
  ) =>
    new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill, color: "auto" },
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      verticalAlign: VerticalAlign.CENTER,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
        left: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
        right: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
      },
      children: [
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: label, bold: true, size: 15, color: labelColor, characterSpacing: 20 }),
          ],
        }),
        new Paragraph({
          children: [new TextRun({ text: value, bold: true, size: valueSize, color: valueColor })],
        }),
      ],
    });

  return new Table({
    width: FULL,
    columnWidths: [3000, 6600],
    rows: [
      new TableRow({
        children: [
          cell(30, TEAL_50, TEAL_200, "BLOOD GROUP", TEAL_700, bloodGroup, TEAL_800, 40),
          cell(
            70,
            crit ? CRIT_BG : TEAL_50,
            crit ? CRIT_BORDER : BORDER,
            "ALLERGIES",
            crit ? CRIT : MUTED,
            allergies.value,
            crit ? CRIT : MUTED,
            24,
          ),
        ],
      }),
    ],
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER, space: 4 } },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 18,
        color: TEAL_700,
        characterSpacing: 20,
      }),
    ],
  });
}

function fieldBlock(field: RecordField): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 60, after: 10 },
      children: [
        new TextRun({
          text: field.label.toUpperCase(),
          bold: true,
          size: 15,
          color: FAINT,
          characterSpacing: 15,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: field.value || "—",
          size: 22,
          color: field.empty ? MUTED : INK,
        }),
      ],
    }),
  ];
}

function pageFooter(generatedFor: string): Footer {
  const stamp = `Generated ${new Date().toLocaleString()}  ·  ${generatedFor}`;
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: BORDER, space: 4 } },
        spacing: { before: 60, after: 20 },
        children: [new TextRun({ text: CONFIDENTIALITY_NOTICE, size: 14, color: FAINT })],
      }),
      new Paragraph({
        children: [new TextRun({ text: stamp, size: 14, color: MUTED })],
      }),
    ],
  });
}
