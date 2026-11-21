// Voice provider contract (spec 8.6, D-04). Implementations: Groq Whisper (STT), ElevenLabs (TTS).
export interface TranscribeResult {
  text: string;
  confidence?: number;
  /** Timed segments of the speech (seconds), when the provider gives them. */
  segments?: { start: number; end: number; text: string }[];
  duration?: number;
}

export interface VoiceProvider {
  readonly name: string;
  /** MIME type of the clips `synthesize` returns (default audio/mpeg). */
  readonly audioType?: string;
  transcribe?(audio: Blob, opts?: { language?: string; vocabulary?: string[] }): Promise<TranscribeResult>;
  /** Returns a complete audio clip (mp3) for one sentence; the caller streams sentence by sentence. */
  synthesize?(text: string, opts?: { voiceId?: string }): Promise<ArrayBuffer>;
}
