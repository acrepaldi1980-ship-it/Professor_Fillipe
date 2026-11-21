// Clock that maps real time to the planned time of the mouth (lib/voice/visemes.ts). It follows the real speed of the voice:
// every word boundary re-anchors it and refines the speed (moving average), so the mouth does not drift away from the speech.
export class SpeechClock {
  /** Real ms per planned ms (>1 = the voice is slower than planned). */
  speed: number;
  private anchorReal = 0;
  private anchorPlan = 0;
  boundaries = 0;

  constructor(initialSpeed = 1) {
    this.speed = initialSpeed;
  }

  start(nowMs: number) {
    this.anchorReal = nowMs;
    this.anchorPlan = 0;
    this.boundaries = 0;
  }

  /** The engine reported that the word planned to start at `planStartMs` is being spoken now. */
  boundary(planStartMs: number, nowMs: number) {
    const dPlan = planStartMs - this.anchorPlan;
    if (dPlan > 150) {
      const observed = (nowMs - this.anchorReal) / dPlan;
      this.speed = 0.65 * this.speed + 0.35 * Math.min(2.2, Math.max(0.5, observed));
    }
    this.anchorPlan = planStartMs;
    this.anchorReal = nowMs;
    this.boundaries++;
  }

  planNow(nowMs: number) {
    return this.anchorPlan + (nowMs - this.anchorReal) / this.speed;
  }
}
