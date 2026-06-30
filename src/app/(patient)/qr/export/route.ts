import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getOwnMedicalProfile } from "@/lib/medical";
import { buildEmergencyView } from "@/lib/emergency";
import { renderRecordPdf } from "@/lib/pdf";
import { qrDataUrl } from "@/lib/qr";

/**
 * Patient self-export (WS4). Streams the signed-in patient's own record as a
 * one-page PDF. Auth is enforced here via the user session — the route never
 * crosses the row-owner boundary; it only ever serves the caller's own row.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const row = await getOwnMedicalProfile();
  if (!row) {
    return new Response("No medical profile found", { status: 404 });
  }

  const current = await getCurrentProfile();
  const view = await buildEmergencyView(row, current?.profile.full_name ?? null);

  const pdf = await renderRecordPdf({
    view,
    qrPngDataUrl: await qrDataUrl(row.qr_token),
    generatedFor: "Patient self-export",
  });

  // Copy into a fresh ArrayBuffer-backed view so the body is a valid BodyInit
  // (pdf-lib returns Uint8Array<ArrayBufferLike>, which TS rejects directly).
  const buffer = new ArrayBuffer(pdf.byteLength);
  new Uint8Array(buffer).set(pdf);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="beacon-record.pdf"',
    },
  });
}
