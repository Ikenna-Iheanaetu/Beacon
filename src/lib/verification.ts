import "server-only";
import { createHmac } from "node:crypto";

/**
 * Provider verification + national-ID hashing (BUILD_SPEC Phase 2).
 *
 * `verifyLicense` is an INTEGRATION STUB: there is no public MDCN/registry API
 * available to a prototype, so this performs a format check plus a mock registry
 * result. It returns a shape ready to be swapped for a real adapter, and its
 * output is persisted to provider_verifications.verify_check_result for the
 * admin reviewer.
 */

export interface LicenseCheck {
  ok: boolean;
  format_valid: boolean;
  registry_match: boolean | null;
  source: "mock";
  checked_at: string;
  detail?: string;
}

const LICENSE_FORMAT = /^[A-Za-z0-9-]{4,32}$/;

export async function verifyLicense(licenseNumber: string): Promise<LicenseCheck> {
  const format_valid = LICENSE_FORMAT.test(licenseNumber.trim());
  // INTEGRATION STUB — replace with a real MDCN/registry lookup. Mock: accept
  // any well-formed number that isn't an obvious test/blocklist value.
  const blocked = ["0000", "TEST", "FAKE"];
  const registry_match = format_valid
    ? !blocked.some((b) => licenseNumber.toUpperCase().includes(b))
    : null;
  return {
    ok: Boolean(format_valid && registry_match),
    format_valid,
    registry_match,
    source: "mock",
    checked_at: new Date().toISOString(),
    detail: format_valid
      ? "Format valid; registry check is a mock pending MDCN API access."
      : "License number format is invalid.",
  };
}

/** Normalize then keyed-HMAC a national ID for exact, privacy-preserving lookup. */
export function nationalIdHash(raw: string): string {
  const normalized = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  const secret =
    process.env.BEACON_NATIONAL_ID_HASH_KEY ?? process.env.BEACON_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("BEACON_NATIONAL_ID_HASH_KEY is not set");
  }
  return createHmac("sha256", secret).update(normalized).digest("hex");
}
