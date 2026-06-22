/**
 * AES-256-GCM field encryption (BUILD_SPEC §8).
 *
 * Used for the three sensitive medical_profiles columns: allergies,
 * medications, medical_conditions. Ciphertext is packed as
 * `base64(iv):base64(ciphertext+tag)` — the GCM auth tag is appended to the
 * ciphertext by Web Crypto, so a single decode recovers both.
 *
 * The key lives in BEACON_ENCRYPTION_KEY (base64-encoded 32 bytes) and must
 * never reach the client. This module guards against being run in a browser.
 */

const KEY_ENV = "BEACON_ENCRYPTION_KEY";
const IV_BYTES = 12; // 96-bit nonce, recommended for GCM
const ALGO = "AES-GCM";

function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error("crypto.ts must never run in the browser");
  }
}

/** Decode base64 into an ArrayBuffer-backed Uint8Array (satisfies BufferSource). */
function toBytes(b64: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(b64, "base64");
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}

/** UTF-8 encode into an ArrayBuffer-backed Uint8Array. */
function strBytes(s: string): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder().encode(s);
  const out = new Uint8Array(enc.byteLength);
  out.set(enc);
  return out;
}

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  return Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString("base64");
}

let cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  assertServer();
  if (cachedKey) return cachedKey;

  const raw = process.env[KEY_ENV];
  if (!raw) {
    throw new Error(`${KEY_ENV} is not set. Generate one with: openssl rand -base64 32`);
  }
  const keyBytes = toBytes(raw);
  if (keyBytes.byteLength !== 32) {
    throw new Error(`${KEY_ENV} must decode to 32 bytes (AES-256); got ${keyBytes.byteLength}`);
  }
  cachedKey = await crypto.subtle.importKey("raw", keyBytes, ALGO, false, [
    "encrypt",
    "decrypt",
  ]);
  return cachedKey;
}

/** Encrypt a plaintext string. Empty/undefined input returns null (store NULL). */
export async function encryptField(plaintext: string | null | undefined): Promise<string | null> {
  if (plaintext == null || plaintext === "") return null;
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    strBytes(plaintext),
  );
  return `${toB64(iv)}:${toB64(ct)}`;
}

/** Decrypt a packed ciphertext string. NULL/empty input returns "". */
export async function decryptField(packed: string | null | undefined): Promise<string> {
  if (packed == null || packed === "") return "";
  const [ivB64, ctB64] = packed.split(":");
  if (!ivB64 || !ctB64) {
    throw new Error("Malformed ciphertext: expected iv:ciphertext");
  }
  const key = await getKey();
  // Throws (OperationError) if the auth tag fails — tamper detection.
  const plain = await crypto.subtle.decrypt(
    { name: ALGO, iv: toBytes(ivB64) },
    key,
    toBytes(ctB64),
  );
  return new TextDecoder().decode(plain);
}

/** Test-only: reset the cached key (e.g. after changing the env in a test). */
export function __resetKeyCache(): void {
  cachedKey = null;
}
