import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getOwnMedicalProfile } from "@/lib/medical";
import { buildEmergencyView } from "@/lib/emergency";
import { qrDataUrl } from "@/lib/qr";
import { exportFormat, recordDownloadResponse } from "@/lib/export-format";

/**
 * Patient self-export (WS4). Streams the signed-in patient's own record as a
 * PDF or Word doc (`?format=docx`). Auth is enforced here via the user session
 * — the route never crosses the row-owner boundary; it only serves the caller's
 * own row.
 */
export async function GET(request: Request) {
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

  return recordDownloadResponse(exportFormat(request.url), {
    view,
    qrPngDataUrl: await qrDataUrl(row.qr_token),
    qrToken: row.qr_token,
    generatedFor: "Patient self-export",
  });
}
