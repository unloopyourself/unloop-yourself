/** Accumulate stillness: low accel variance over a hold window. */

export const HOLD_STILL_CHALLENGE_ID = "hold_still" as const;

export type HoldStillProgress = {
  readonly complete: boolean;
  readonly heldMs: number;
  readonly requiredMs: number;
};

/**
 * Gravity-ish magnitude near 1g with low sample-to-sample change counts as still.
 * `deviation` is |√(x²+y²+z²) − 1|; `jerk` is |mag − prevMag|.
 */
export function advanceHoldStillProgress(
  heldMs: number,
  tick: {
    deviation: number;
    jerk: number;
    deltaMs: number;
    requiredMs?: number;
    maxDeviation?: number;
    maxJerk?: number;
  },
): HoldStillProgress {
  const requiredMs = tick.requiredMs ?? 5_000;
  const maxDeviation = tick.maxDeviation ?? 0.12;
  const maxJerk = tick.maxJerk ?? 0.08;
  const still =
    tick.deviation <= maxDeviation && tick.jerk <= maxJerk;
  const next = still ? heldMs + tick.deltaMs : 0;
  return {
    complete: next >= requiredMs,
    heldMs: Math.min(next, requiredMs),
    requiredMs,
  };
}
