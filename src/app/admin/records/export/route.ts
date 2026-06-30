import { requireAdmin } from "@/lib/admin-guard";
import { adminReadRecord, logAdminAction } from "@/lib/admin";
import { getCurrentProfile } from "@/lib/auth";
import { exportFormat, recordDownloadResponse } from "@/lib/export-format";
import { qrDataUrl } from "@/lib/qr";

/**
 * Admin record export (WS3). Re-derives the record via adminReadRecord using
 * the patientId + reason query params (which re-enforces the reason guard and
 * logs the read), then logs a separate pdf_export action and streams the chosen
 * format (PDF, or Word via `?format=docx`).
 */
export async function GET(request: Request) {
  let adminUser;
  try {
    adminUser = await requireAdmin();
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const patientId = url.searchParams.get("patientId") ?? "";
  const reason = url.searchParams.get("reason") ?? "";
  if (!patientId) {
    return new Response("Missing patient", { status: 400 });
  }

  const ctx = await getCurrentProfile();
  const adminName = ctx?.profile.full_name ?? ctx?.user.email ?? null;

  try {
    const { view, qrToken } = await adminReadRecord({
      patientId,
      reason,
      adminId: adminUser.id,
      adminName,
    });
    await logAdminAction({
      adminId: adminUser.id,
      actionType: "pdf_export",
      patientId,
      reason,
    });
    return recordDownloadResponse(exportFormat(request.url), {
      view,
      qrPngDataUrl: await qrDataUrl(qrToken),
      qrToken,
      generatedFor: "Admin export",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    return new Response(message, { status: 400 });
  }
}
