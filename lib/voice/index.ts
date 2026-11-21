import { ElevenLabsTtsProvider } from "./providers/elevenlabs-tts";
import { GeminiTtsProvider } from "./providers/gemini-tts";
import { GroqSttProvider } from "./providers/groq-stt";
import { PiperTtsProvider } from "./providers/piper-tts";
import type { VoiceProvider } from "./types";

export const stt = () => new GroqSttProvider();

/** Teacher voice: Gemini when configured (VOICE_PROVIDER=gemini, or a GEMINI_API_KEY and no other choice), else ElevenLabs. */
export const tts = (): VoiceProvider => {
  const choice = process.env.VOICE_PROVIDER;
  if (choice === "gemini" || (choice !== "elevenlabs" && process.env.GEMINI_API_KEY)) return new GeminiTtsProvider();
  return new ElevenLabsTtsProvider();
};

/**
 * Male server voices in order of preference (the teacher is a man, owner's rule 21/11/2026): the configured provider first, then the
 * other one when it has a key. Gemini voice "Charon" and ElevenLabs "George" are male. If every provider fails, the client uses a
 * male voice of the device, or shows the text only: it never speaks with a female voice.
 */
export function ttsChain(): VoiceProvider[] {
  const chain: VoiceProvider[] = [];
  // Piper (free, offline male voice) first when chosen, otherwise it is the last resort after the paid providers.
  if (process.env.VOICE_PROVIDER === "piper") return [new PiperTtsProvider()];
  const first = tts();
  chain.push(first);
  if (first.name !== "gemini" && process.env.GEMINI_API_KEY) chain.push(new GeminiTtsProvider());
  if (first.name !== "elevenlabs" && process.env.VOICE_API_KEY) chain.push(new ElevenLabsTtsProvider());
  chain.push(new PiperTtsProvider());
  return chain;
}
