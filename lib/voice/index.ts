import { ElevenLabsTtsProvider } from "./providers/elevenlabs-tts";
import { GeminiTtsProvider } from "./providers/gemini-tts";
import { GroqSttProvider } from "./providers/groq-stt";
import type { VoiceProvider } from "./types";

export const stt = () => new GroqSttProvider();

/** Teacher voice: Gemini when configured (VOICE_PROVIDER=gemini, or a GEMINI_API_KEY and no other choice), else ElevenLabs. */
export const tts = (): VoiceProvider => {
  const choice = process.env.VOICE_PROVIDER;
  if (choice === "gemini" || (choice !== "elevenlabs" && process.env.GEMINI_API_KEY)) return new GeminiTtsProvider();
  return new ElevenLabsTtsProvider();
};
