import { requireAdmin } from "@/lib/admin-guard";
import { adminReadRecord, logAdminAction } from "@/lib/admin";
import { getCurrentProfile } from "@/lib/auth";
import { renderRecordPdf } from "@/lib/pdf";

/**
 * Admin record export (WS3). Re-derives the record via adminReadRecord using
 * the patientId + reason query params (which re-enforces the reason guard and
 * logs the read), then logs a separate pdf_export action and streams the PDF.
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
    const { view } = await adminReadRecord({
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
    const pdf = await renderRecordPdf({ view, generatedFor: "Admin export" });

    return new Response(new Blob([pdf as BlobPart]), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="beacon-record.pdf"',
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    return new Response(message, { status: 400 });
  }
}
