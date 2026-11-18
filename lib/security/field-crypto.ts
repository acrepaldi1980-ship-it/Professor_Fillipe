// Column-level encryption for sensitive religious data (spec 13): AES-256-GCM with a key from FIELD_ENCRYPTION_KEY
// (base64, 32 bytes). The database stores only "enc:v1:<iv>.<tag>.<ciphertext>" and never sees plaintext.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function key(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) throw new Error("field_encryption_key_missing");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("field_encryption_key_invalid");
  return k;
}

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `${PREFIX}${[iv, c.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".")}`;
}

export function decryptField(token: string): string {
  if (!token.startsWith(PREFIX)) throw new Error("not_encrypted");
  const [iv, tag, ct] = token.slice(PREFIX.length).split(".").map((s) => Buffer.from(s, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

export const isEncrypted = (v: string | null | undefined): v is string => !!v && v.startsWith(PREFIX);

export const encryptJson = (v: unknown) => encryptField(JSON.stringify(v));
export const decryptJson = <T>(token: string): T => JSON.parse(decryptField(token)) as T;
