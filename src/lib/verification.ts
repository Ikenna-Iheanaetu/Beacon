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

/**
 * Facility (institution) verification — an INTEGRATION STUB, mirroring
 * verifyLicense. No public NHFR/HEFAMAA/CAC lookup API is available to a
 * prototype, so this format-checks the registry identifiers an institution
 * supplied and returns a mock registry result. At least one registry number
 * plus the Medical Director's MDCN folio must be present for an "ok" result.
 * Output is persisted to institutions.verify_check_result for the reviewer.
 */
export interface FacilityCheck {
  ok: boolean;
  format_valid: boolean;
  registry_match: boolean | null;
  identifiers_present: string[];
  source: "mock";
  checked_at: string;
  detail?: string;
}

const NHFR_FORMAT = /^[A-Za-z0-9/-]{3,40}$/;
const STATE_MOH_FORMAT = /^[A-Za-z0-9/-]{3,40}$/;
const CAC_FORMAT = /^(RC)?\d{4,12}$/i;
const MDCN_FORMAT = /^[A-Za-z0-9-]{4,32}$/;

export interface FacilityIdentifiers {
  nhfr_code?: string | null;
  state_moh_reg_no?: string | null;
  cac_rc_number?: string | null;
  medical_director_mdcn?: string | null;
}

export async function verifyFacility(
  ids: FacilityIdentifiers,
): Promise<FacilityCheck> {
  const checks: Array<{ key: string; value: string; re: RegExp }> = [];
  const present: string[] = [];

  const nhfr = ids.nhfr_code?.trim();
  const moh = ids.state_moh_reg_no?.trim();
  const cac = ids.cac_rc_number?.trim();
  const mdcn = ids.medical_director_mdcn?.trim();

  if (nhfr) {
    present.push("nhfr_code");
    checks.push({ key: "nhfr_code", value: nhfr, re: NHFR_FORMAT });
  }
  if (moh) {
    present.push("state_moh_reg_no");
    checks.push({ key: "state_moh_reg_no", value: moh, re: STATE_MOH_FORMAT });
  }
  if (cac) {
    present.push("cac_rc_number");
    checks.push({ key: "cac_rc_number", value: cac, re: CAC_FORMAT });
  }
  if (mdcn) {
    present.push("medical_director_mdcn");
    checks.push({ key: "medical_director_mdcn", value: mdcn, re: MDCN_FORMAT });
  }

  const format_valid =
    checks.length > 0 && checks.every((c) => c.re.test(c.value));

  // INTEGRATION STUB — replace with real NHFR / HEFAMAA / CAC lookups. Mock:
  // require at least one facility registry number AND the Medical Director's
  // MDCN folio (the bridge to the practitioner layer), all well-formed and not
  // an obvious test value.
  const blocked = ["0000", "TEST", "FAKE"];
  const hasFacilityRegistry = Boolean(nhfr || moh || cac);
  const hasDirector = Boolean(mdcn);
  const notBlocked = checks.every(
    (c) => !blocked.some((b) => c.value.toUpperCase().includes(b)),
  );
  const registry_match = format_valid
    ? hasFacilityRegistry && hasDirector && notBlocked
    : null;

  let detail: string;
  if (!format_valid) {
    detail = "One or more facility identifiers have an invalid format.";
  } else if (!hasFacilityRegistry) {
    detail = "Provide at least one facility registry number (NHFR, State MoH, or CAC).";
  } else if (!hasDirector) {
    detail = "A Medical Director's MDCN number is required.";
  } else {
    detail =
      "Identifiers well-formed; registry check is a mock pending NHFR/HEFAMAA/CAC API access.";
  }

  return {
    ok: Boolean(registry_match),
    format_valid,
    registry_match,
    identifiers_present: present,
    source: "mock",
    checked_at: new Date().toISOString(),
    detail,
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
