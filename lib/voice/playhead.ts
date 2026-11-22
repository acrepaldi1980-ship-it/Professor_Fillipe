// Where is the sound that the listener hears right now? The audio clock runs ahead of the speakers (output buffer, Bluetooth...): the browser tells the
// delay in getOutputTimestamp(). Without it, the best estimate is currentTime minus the reported latencies.
export interface ClockLike {
  currentTime: number;
  baseLatency?: number;
  outputLatency?: number;
  getOutputTimestamp?: () => { contextTime?: number; performanceTime?: number };
}

/** Audible position on the audio clock, in seconds. `nowPerfMs` is performance.now(). */
export function audiblePlayhead(ctx: ClockLike, nowPerfMs: number): number {
  const ts = ctx.getOutputTimestamp?.();
  if (ts && typeof ts.contextTime === "number" && typeof ts.performanceTime === "number" && ts.performanceTime > 0) {
    return ts.contextTime + (nowPerfMs - ts.performanceTime) / 1000;
  }
  return ctx.currentTime - (ctx.outputLatency ?? 0) - (ctx.baseLatency ?? 0.01);
}
