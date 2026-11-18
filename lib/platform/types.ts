// Platform interfaces (spec 10.6.2). The web implementation lives in ./web;
// the native (Capacitor) one arrives in Phase 2. App code must only touch
// browser APIs for these capabilities through getPlatform().

export type PlatformName = "web" | "ios" | "android";

export interface Microphone {
  isSupported(): boolean;
  /** Requests permission and starts capturing. Resolves once recording has started. */
  start(): Promise<void>;
  /** Stops capturing and returns the recorded audio. */
  stop(): Promise<Blob>;
  /** Called with an audio level between 0 and 1 while recording (used for end-of-speech detection). */
  onLevel(cb: (level: number) => void): () => void;
}

export interface AudioPlayer {
  /** Plays a chunk or file; resolves when playback of it finishes. */
  play(source: Blob | ArrayBuffer | string): Promise<void>;
  /** Stops immediately (barge-in, RF-M06-04: must stop within 300 ms). */
  stop(): void;
  isPlaying(): boolean;
  setRate(rate: number): void;
  /** Called with the playback level between 0 and 1 (drives the avatar mouth, RF-M17-02). */
  onLevel(cb: (level: number) => void): () => void;
}

export interface Platform {
  name: PlatformName;
  microphone: Microphone;
  audioPlayer: AudioPlayer;
}
