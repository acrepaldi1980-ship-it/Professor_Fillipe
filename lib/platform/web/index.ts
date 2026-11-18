import type { Platform } from "../types";
import { WebMicrophone } from "./microphone";
import { WebAudioPlayer } from "./audio-player";

export function createWebPlatform(): Platform {
  return { name: "web", microphone: new WebMicrophone(), audioPlayer: new WebAudioPlayer() };
}
