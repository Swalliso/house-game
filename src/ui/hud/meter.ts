// The milestone meter's week ticks (M5a): where the run's Wow should be at the end of each week
// of the phase, at the rules' own pace (rules.pace: what's left of the target when the phase
// began, spread over its weeks). The UI only turns those numbers into fractions of the meter.

/**
 * The ticks, as fractions of the target (0 to 1, exclusive), one per week boundary inside the
 * phase. A phase that began at or past its target has none: there's nothing left to pace.
 */
export function weekTicks(start: number, pace: number, target: number, weeks: number): number[] {
  const ticks: number[] = [];
  if (target <= 0) return ticks;
  for (let k = 1; k < weeks; k++) {
    const at = (start + pace * k) / target;
    if (at > 0 && at < 1) ticks.push(at);
  }
  return ticks;
}
