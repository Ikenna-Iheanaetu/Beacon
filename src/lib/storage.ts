import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Private Storage helpers (BUILD_SPEC Phase 2). Buckets `license-docs` and
 * `record-exports` are private; the only way to read an object is a short-lived
 * secret-key signed URL. Object paths are namespaced by owner uid.
 */

export const LICENSE_BUCKET = "license-docs";
export const EXPORT_BUCKET = "record-exports";
export const INSTITUTION_BUCKET = "institution-docs";

/** Upload a doctor's license document. `path` should start with `<uid>/`. */
export async function uploadLicenseDoc(
  path: string,
  file: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<{ path: string }> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(LICENSE_BUCKET)
    .upload(path, file, { contentType, upsert: true });
  if (error) throw new Error(`license upload failed: ${error.message}`);
  return { path };
}

/** Short-lived signed URL to view a license document (admin review). */
export async function signedLicenseUrl(
  path: string,
  expiresInSec = 120,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.storage
    .from(LICENSE_BUCKET)
    .createSignedUrl(path, expiresInSec);
  return data?.signedUrl ?? null;
}

/** Upload a facility's registration document. `path` should start with `<uid>/`. */
export async function uploadInstitutionDoc(
  path: string,
  file: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<{ path: string }> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(INSTITUTION_BUCKET)
    .upload(path, file, { contentType, upsert: true });
  if (error) throw new Error(`institution upload failed: ${error.message}`);
  return { path };
}

/** Short-lived signed URL to view a facility registration document (admin review). */
export async function signedInstitutionUrl(
  path: string,
  expiresInSec = 120,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.storage
    .from(INSTITUTION_BUCKET)
    .createSignedUrl(path, expiresInSec);
  return data?.signedUrl ?? null;
}

/** Store a generated record PDF for QR-to-PDF transfer. */
export async function uploadRecordPdf(
  path: string,
  bytes: Uint8Array,
): Promise<{ path: string }> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(EXPORT_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`record upload failed: ${error.message}`);
  return { path };
}

/** Short-lived signed URL to download a stored record PDF. */
export async function signedRecordUrl(
  path: string,
  expiresInSec = 600,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.storage
    .from(EXPORT_BUCKET)
    .createSignedUrl(path, expiresInSec);
  return data?.signedUrl ?? null;
}
