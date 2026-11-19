import { describe, expect, it } from "vitest";
import { pcmToWav } from "@/lib/voice/wav";

describe("pcmToWav", () => {
  it("writes a valid 24 kHz mono 16-bit WAV header", () => {
    const wav = new DataView(pcmToWav(new Uint8Array(100)));
    expect(String.fromCharCode(wav.getUint8(0), wav.getUint8(1), wav.getUint8(2), wav.getUint8(3))).toBe("RIFF");
    expect(wav.getUint32(4, true)).toBe(136);
    expect(wav.getUint32(24, true)).toBe(24000);
    expect(wav.getUint16(22, true)).toBe(1);
    expect(wav.getUint16(34, true)).toBe(16);
    expect(wav.getUint32(40, true)).toBe(100);
  });
});
