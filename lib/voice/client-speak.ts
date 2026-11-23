// The teacher's voice for screens other than the conversation (closing summary, review): server voice first (Gemini, the same family as
// the greeting), the device voice when it is unavailable. Not used for the main conversation, which has its own lip-sync player.
import { getLanguage } from "@/lib/i18n";
import { answerVoice } from "@/lib/api-client";
import { getPlatform } from "@/lib/platform";
import { loadPrefs } from "@/lib/prefs";
import { shortFirstChunk, splitSentences } from "./speech-text";
import { speakQueue } from "./speak-queue";

let server: "unknown" | "ok" | "down" = "unknown";
let token = 0;

export function stopSpeaking() {
  token++;
  getPlatform().audioPlayer.stop();
  getPlatform().speech.cancel();
}

/** Speaks with the teacher's (male) voice. Resolves false when no male voice was available anywhere (the caller then shows the text only). */
export async function speakText(text: string, onLevel?: (level: number) => void): Promise<boolean> {
  const my = ++token;
  const platform = getPlatform();
  const unsubscribe = onLevel ? platform.audioPlayer.onLevel(onLevel) : undefined;
  let spokeAny = false;
  try {
    const sentences = shortFirstChunk(splitSentences(text));
    let from = 0;
    const source = (await loadPrefs()).voiceSource; // not chosen yet: a premium device voice (Edge "Antonio Natural", iOS enhanced) beats the server voice
      const deviceOnly = platform.speech.isSupported() && (source === "device" || (source === undefined && (await platform.speech.hasPremiumVoice())));
    if (server !== "down" && !deviceOnly && getLanguage() === "pt-BR") { // the server voice (Piper) speaks Portuguese; in Spanish the device voice is used
      // the sentences are requested together and queued back to back: no pause between them
      const r = await speakQueue(sentences, { fetchAudio: answerVoice(), player: platform.audioPlayer, isCurrent: () => my === token });
      if (r.played) { server = "ok"; spokeAny = true; }
      if (r.failedAt !== null) { server = "down"; from = r.failedAt; } else from = sentences.length;
    }
    for (let i = from; i < sentences.length && my === token; i++) {
      if (!platform.speech.isSupported()) break;
      let missing = false;
      await platform.speech.speak(sentences[i], { voiceName: (await loadPrefs()).voiceName, onLevel, onUnavailable: () => { missing = true; } });
      if (missing) return spokeAny;
      spokeAny = true;
    }
    return spokeAny;
  } finally {
    unsubscribe?.();
  }
}
