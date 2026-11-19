import type { Platform } from "../types";
import { WebAudioPlayer } from "./audio-player";
import { WebMicrophone } from "./microphone";
import { WebSpeech } from "./speech";
import { WebDeepLinks, WebFiles, WebHaptics, WebLocalStore, WebPurchases, WebPush, WebShare, WebStatusBar } from "./misc";

export function createWebPlatform(): Platform {
  return {
    name: "web",
    microphone: new WebMicrophone(),
    audioPlayer: new WebAudioPlayer(),
    speech: new WebSpeech(),
    push: new WebPush(),
    store: new WebLocalStore(),
    share: new WebShare(),
    files: new WebFiles(),
    deepLinks: new WebDeepLinks(),
    purchases: new WebPurchases(),
    haptics: new WebHaptics(),
    statusBar: new WebStatusBar(),
  };
}
