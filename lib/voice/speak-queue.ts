// Plays the sentences of one answer with the server voice without waiting between them: the audio of the next sentences is requested while the first one
// is still being synthesized or played, and every clip is queued right behind the previous one on the audio clock.
import type { AudioPlayer } from "@/lib/platform/types";

export interface QueueOptions {
  fetchAudio(sentence: string, index: number): Promise<Blob>;
  player: Pick<AudioPlayer, "enqueue">;
  /** False when this answer was cancelled (the student interrupted or asked something else). */
  isCurrent(): boolean;
  /** Fires when the first sound is really audible. */
  onFirstSound?: () => void;
  /** Sentences requested ahead (default 3). */
  concurrency?: number;
}

export async function speakQueue(sentences: string[], o: QueueOptions): Promise<{ played: number; failedAt: number | null }> {
  const conc = Math.max(1, o.concurrency ?? 3);
  const blobs: Promise<Blob>[] = [];
  const start = (i: number) => { if (i < sentences.length && !blobs[i]) { blobs[i] = o.fetchAudio(sentences[i], i); blobs[i].catch(() => undefined); } };
  for (let i = 0; i < Math.min(conc, sentences.length); i++) start(i);
  const playing: Promise<void>[] = [];
  let played = 0, failedAt: number | null = null;
  for (let i = 0; i < sentences.length; i++) {
    if (!o.isCurrent()) break;
    let blob: Blob;
    try { blob = await blobs[i]; } catch { failedAt = i; break; }
    if (!o.isCurrent()) break;
    start(i + conc);
    playing.push(o.player.enqueue(blob, { onStart: i === 0 ? o.onFirstSound : undefined }));
    played++;
  }
  await Promise.all(playing);
  return { played, failedAt };
}
