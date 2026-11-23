"use client";

// Reads a text aloud with the server voice, one sentence after another without gaps (the device voice is the fallback), for screens that narrate content.
import { useCallback, useEffect, useRef, useState } from "react";
import { answerVoice } from "@/lib/api-client";
import { getPlatform } from "@/lib/platform";
import { speakQueue } from "@/lib/voice/speak-queue";
import { splitSentences } from "@/lib/voice/speech-text";

export function useNarrator() {
  const [playing, setPlaying] = useState<string | null>(null);
  const run = useRef(0);
  const stop = useCallback(() => { run.current++; getPlatform().audioPlayer.stop(); getPlatform().speech.cancel(); setPlaying(null); }, []);
  useEffect(() => stop, [stop]);
  const play = useCallback(async (id: string, text: string) => {
    const my = ++run.current;
    getPlatform().audioPlayer.stop(); getPlatform().speech.cancel();
    setPlaying(id);
    const sentences = splitSentences(text);
    try {
      const r = await speakQueue(sentences, { fetchAudio: answerVoice(), player: getPlatform().audioPlayer, isCurrent: () => my === run.current });
      if (r.failedAt !== null && getPlatform().speech.isSupported()) for (let i = r.failedAt; i < sentences.length && my === run.current; i++) await getPlatform().speech.speak(sentences[i], {});
    } catch { /* silent: the text is always on the page */ }
    if (my === run.current) setPlaying(null);
  }, []);
  return { playing, play, stop };
}
