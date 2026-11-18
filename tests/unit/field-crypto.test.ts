import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptField, decryptJson, encryptField, encryptJson, isEncrypted } from "@/lib/security/field-crypto";

const saved = process.env.FIELD_ENCRYPTION_KEY;
beforeEach(() => {
  process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});
afterEach(() => {
  process.env.FIELD_ENCRYPTION_KEY = saved;
});

describe("field encryption", () => {
  it("round-trips text and JSON (including accents)", () => {
    expect(decryptField(encryptField("pastor evangélico"))).toBe("pastor evangélico");
    expect(decryptJson<string[]>(encryptJson(["pentecostal", "batista"]))).toEqual(["pentecostal", "batista"]);
  });

  it("never stores plaintext and uses a fresh IV each time", () => {
    const a = encryptField("pentecostal");
    const b = encryptField("pentecostal");
    expect(a).not.toContain("pentecostal");
    expect(a).not.toBe(b);
    expect(isEncrypted(a)).toBe(true);
    expect(isEncrypted("pentecostal")).toBe(false);
  });

  it("detects tampering and the wrong key", () => {
    const t = encryptField("segredo");
    const parts = t.split(".");
    parts[2] = parts[2].slice(0, -2) + (parts[2].endsWith("AA") ? "BB" : "AA");
    expect(() => decryptField(parts.join("."))).toThrow();
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(() => decryptField(t)).toThrow();
  });

  it("fails loudly without a valid key", () => {
    process.env.FIELD_ENCRYPTION_KEY = "";
    expect(() => encryptField("x")).toThrow("field_encryption_key_missing");
    process.env.FIELD_ENCRYPTION_KEY = Buffer.from("curta").toString("base64");
    expect(() => encryptField("x")).toThrow("field_encryption_key_invalid");
  });
});
