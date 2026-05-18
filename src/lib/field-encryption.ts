import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const VERSION = "v1";

function getEncryptionKey(): Buffer {
  const raw = process.env.VERIFICATION_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("MISSING_VERIFICATION_CREDENTIALS_ENCRYPTION_KEY");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error("INVALID_VERIFICATION_CREDENTIALS_ENCRYPTION_KEY");
  }
  return key;
}

/** Cifra un valor antes de guardarlo en Postgres (AES-256-GCM). */
export function encryptSensitiveField(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(":");
}

/** Descifra un valor leído de la base de datos. */
export function decryptSensitiveField(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("INVALID_ENCRYPTED_PAYLOAD");
  }
  const [, ivB64, ciphertextB64, tagB64] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, "base64url");
  const ciphertext = Buffer.from(ciphertextB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
