import { ElevenLabsTtsProvider } from "./providers/elevenlabs-tts";
import { GroqSttProvider } from "./providers/groq-stt";

export const stt = () => new GroqSttProvider();
export const tts = () => new ElevenLabsTtsProvider();
