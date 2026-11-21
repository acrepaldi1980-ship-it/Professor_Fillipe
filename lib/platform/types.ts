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

export type PermissionState = "granted" | "denied" | "default" | "unsupported";

export interface PushNotifications {
  isSupported(): boolean;
  requestPermission(): Promise<PermissionState>;
  /** Web Push subscription (JSON string) or native token; null when unavailable. */
  getToken(): Promise<string | null>;
}

export interface LocalStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface Share {
  canShare(): boolean;
  share(data: { title?: string; text?: string; url?: string }): Promise<"shared" | "copied" | "unavailable">;
}

export interface Files {
  /** Saves a file for the user (browser download on web; device storage on native). */
  save(name: string, data: Blob): Promise<void>;
}

export interface DeepLinks {
  /** Called when the app is opened through a link (Universal/App Links on native; no-op on web). */
  onOpen(cb: (url: string) => void): () => void;
  currentUrl(): string;
}

export interface Purchases {
  /** Web: sends the user to the web checkout. Native (Phase 2, D-10): store purchase flow. */
  openCheckout(checkoutUrl: string): Promise<void>;
}

export interface Haptics {
  impact(style?: "light" | "medium" | "heavy"): void;
}

export interface StatusBar {
  setStyle(style: "light" | "dark"): void;
}

export interface SpeechOptions {
  rate?: number;
  pitch?: number;
  /** Exact name of a device voice chosen by the student (otherwise the best male pt-BR voice). */
  voiceName?: string | null;
  onLevel?: (level: number) => void;
  /** Called instead of speaking when the device has no male voice. */
  onUnavailable?: () => void;
}

export interface Speech {
  isSupported(): boolean;
  /** Must be called from a user gesture (iOS blocks speech otherwise). */
  unlock(): void;
  /** Speaks one sentence with the best pt-BR voice of the device; resolves when it ends. onLevel drives the mouth. */
  speak(text: string, opts?: SpeechOptions): Promise<void>;
  cancel(): void;
  /** True when the device has at least one male Portuguese voice (the teacher never speaks with a female voice). */
  hasMaleVoice(): Promise<boolean>;
  /** Portuguese voices installed on the device, best first (male voices first: the teacher is a mature man). */
  voices(): Promise<{ name: string; lang: string }[]>;
}

export interface Platform {
  name: PlatformName;
  microphone: Microphone;
  audioPlayer: AudioPlayer;
  speech: Speech;
  push: PushNotifications;
  store: LocalStore;
  share: Share;
  files: Files;
  deepLinks: DeepLinks;
  purchases: Purchases;
  haptics: Haptics;
  statusBar: StatusBar;
}
