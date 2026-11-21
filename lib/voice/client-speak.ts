// The teacher's voice for screens other than the conversation (closing summary, review): server voice first (Gemini, the same family as
// the greeting), the device voice when it is unavailable. Not used for the main conversation, which has its own lip-sync player.
import { speakSentence } from "@/lib/api-client";
import { getPlatform } from "@/lib/platform";
import { loadPrefs } from "@/lib/prefs";
import { splitSentences } from "./speech-text";

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
    for (const sentence of splitSentences(text)) {
      if (my !== token) return spokeAny;
      let played = false;
      if (server !== "down") {
        try {
          const blob = await speakSentence(sentence);
          if (my !== token) return spokeAny;
          server = "ok";
          await platform.audioPlayer.play(blob);
          played = true;
          spokeAny = true;
        } catch {
          server = "down";
        }
      }
      if (!played && my === token && platform.speech.isSupported()) {
        let missing = false;
        await platform.speech.speak(sentence, { voiceName: (await loadPrefs()).voiceName, onLevel, onUnavailable: () => { missing = true; } });
        if (missing) return spokeAny;
        spokeAny = true;
      }
    }
    return spokeAny;
  } finally {
    unsubscribe?.();
  }
}
