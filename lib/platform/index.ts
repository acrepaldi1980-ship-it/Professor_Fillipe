import type { Platform } from "./types";
import { createWebPlatform } from "./web";

export type { Platform, PlatformName, Microphone, AudioPlayer } from "./types";

let current: Platform | null = null;

/** Single entry point for platform capabilities (spec 10.6.2). Phase 2 adds the Capacitor branch. */
export function getPlatform(): Platform {
  current ??= createWebPlatform();
  return current;
}

/** For tests: inject fake implementations. */
export function setPlatformForTests(p: Platform | null) {
  current = p;
}
