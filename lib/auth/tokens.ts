import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/** Server-only OAuth token encryption (AES-256-GCM). Tokens are NEVER stored in plain text,
 *  sent to the client, or included in exports. Requires FLOWMIND_TOKEN_ENCRYPTION_SECRET. */

function deriveKey(): Buffer {
  const secret = process.env.FLOWMIND_TOKEN_ENCRYPTION_SECRET;
  if (!secret) throw new Error("FLOWMIND_TOKEN_ENCRYPTION_SECRET is not set — cannot store OAuth tokens.");
  return scryptSync(secret, "flowmind-token-salt-v1", 32);
}

/** Encrypt a token → "iv.tag.ciphertext" (base64 parts). */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

/** Decrypt "iv.tag.ciphertext" → plaintext. Throws on tamper/missing key. */
export function decryptToken(payload: string): string {
  const [ivB, tagB, encB] = payload.split(".");
  if (!ivB || !tagB || !encB) throw new Error("Malformed encrypted token.");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encB, "base64")), decipher.final()]).toString("utf8");
}
