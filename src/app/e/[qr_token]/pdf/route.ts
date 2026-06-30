import { type NextRequest } from "next/server";
import { getCurrentProfile, isApprovedProvider } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildEmergencyView } from "@/lib/emergency";
import { renderRecordPdf } from "@/lib/pdf";
import { qrDataUrl } from "@/lib/qr";

/**
 * Doctor PDF download from the scanned emergency view (BUILD_SPEC Phase 2).
 *
 * An approved doctor who has opened /e/{token} can download the record as a
 * PDF — but only with a typed reason, which is written to the patient-visible
 * access log (access_type 'pdf_export', note=reason). Mirrors the emergency
 * read's privileged path + kill switch.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ qr_token: string }> },
) {
  const { qr_token } = await params;
  const reason = (req.nextUrl.searchParams.get("reason") ?? "").trim();

  const session = await getCurrentProfile();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!isApprovedProvider(session.profile)) {
    return new Response("Forbidden", { status: 403 });
  }
  if (reason.length < 10) {
    return new Response("A reason (min 10 characters) is required.", {
      status: 400,
    });
  }

  const admin = createAdminClient();
  const { data: mp } = await admin
    .from("medical_profiles")
    .select("*")
    .eq("qr_token", qr_token)
    .maybeSingle();
  if (!mp) return new Response("Not found", { status: 404 });
  if (mp.emergency_access_enabled === false) {
    return new Response("Emergency access is paused by the patient.", {
      status: 403,
    });
  }

  const { data: prof } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", mp.user_id)
    .maybeSingle();
  const view = await buildEmergencyView(mp, prof?.full_name ?? null);

  // Audit — patient-visible, with the doctor's reason.
  await admin.from("access_logs").insert({
    accessor_id: session.user.id,
    patient_id: mp.id,
    access_type: "pdf_export",
    accessor_name: session.profile.full_name,
    accessor_email: session.user.email ?? null,
    note: `Downloaded record as PDF — ${reason}`,
  });

  const pdf = await renderRecordPdf({
    view,
    qrPngDataUrl: await qrDataUrl(mp.qr_token),
    generatedFor: `Downloaded by ${session.profile.full_name ?? "a verified doctor"}`,
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
