import "server-only";
import { renderRecordPdf, type RecordPdfInput } from "@/lib/pdf";
import { renderRecordDocx } from "@/lib/docx";

/**
 * Shared export plumbing for the record download routes. Each route enforces
 * its own auth/audit, then delegates here to render the chosen format and build
 * a downloadable Response — so PDF and Word stay one-line apart at every seam.
 */

export type ExportFormat = "pdf" | "docx";

/** Parse `?format=` from a request URL; defaults to PDF for any other value. */
export function exportFormat(url: string): ExportFormat {
  return new URL(url).searchParams.get("format") === "docx" ? "docx" : "pdf";
}

const META: Record<ExportFormat, { type: string; ext: string }> = {
  pdf: { type: "application/pdf", ext: "pdf" },
  docx: {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: "docx",
  },
};

/** Render the record in the requested format and return a download Response. */
export async function recordDownloadResponse(
  format: ExportFormat,
  input: RecordPdfInput,
  filenameBase = "beacon-record",
): Promise<Response> {
  const bytes =
    format === "docx"
      ? await renderRecordDocx({
          view: input.view,
          generatedFor: input.generatedFor,
          qrPngDataUrl: input.qrPngDataUrl,
          qrToken: input.qrToken,
        })
      : await renderRecordPdf(input);

  // Copy into a fresh ArrayBuffer-backed view so the body is a valid BodyInit
  // (the renderers return Uint8Array<ArrayBufferLike>, which TS rejects directly).
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);

  const { type, ext } = META[format];
  return new Response(buffer, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filenameBase}.${ext}"`,
    },
  });
}
