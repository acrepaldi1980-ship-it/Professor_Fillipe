import { describe, expect, it } from "vitest";
import { PiperTtsProvider, piperAvailable } from "@/lib/voice/providers/piper-tts";
import { ttsChain } from "@/lib/voice";

describe("piper voice", () => {
  it("is the only provider when VOICE_PROVIDER=piper and the last resort otherwise", () => {
    const old = process.env.VOICE_PROVIDER;
    process.env.VOICE_PROVIDER = "piper";
    expect(ttsChain().map((p) => p.name)).toEqual(["piper"]);
    process.env.VOICE_PROVIDER = "elevenlabs";
    const names = ttsChain().map((p) => p.name);
    expect(names[names.length - 1]).toBe("piper");
    process.env.VOICE_PROVIDER = old;
  });
  it.skipIf(!piperAvailable())("speaks a Portuguese sentence as a WAV clip", async () => {
    const wav = await new PiperTtsProvider().synthesize("Olá, eu sou o Professor Filipe. Entendes o que lês?");
    const head = new TextDecoder().decode(new Uint8Array(wav).slice(0, 4));
    expect(head).toBe("RIFF");
    expect(wav.byteLength).toBeGreaterThan(50_000); // more than ~1 s of 22 kHz audio
  });
});
