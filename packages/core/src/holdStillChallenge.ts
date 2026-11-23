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
 * Optional `gyroRate` (rad/s): when provided, micro-rotations also break stillness
 * (advanced path on devices with a gyroscope).
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
    /** Angular-rate magnitude; omit when no gyro. */
    gyroRate?: number;
    maxGyroRate?: number;
  },
): HoldStillProgress {
  const requiredMs = tick.requiredMs ?? 5_000;
  const maxDeviation = tick.maxDeviation ?? 0.12;
  const maxJerk = tick.maxJerk ?? 0.08;
  const maxGyroRate = tick.maxGyroRate ?? 0.35;
  const gyroOk =
    tick.gyroRate === undefined || tick.gyroRate <= maxGyroRate;
  const still =
    tick.deviation <= maxDeviation &&
    tick.jerk <= maxJerk &&
    gyroOk;
  const next = still ? heldMs + tick.deltaMs : 0;
  return {
    complete: next >= requiredMs,
    heldMs: Math.min(next, requiredMs),
    requiredMs,
  };
}
