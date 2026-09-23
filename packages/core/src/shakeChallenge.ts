import type { Challenge } from "./challenge.js";

export const SHAKE_CHALLENGE_ID = "shake" as const;

/** MVP ShakeChallenge: requires accelerometer; ~5s of sustained motion. */
export const shakeChallenge: Challenge = {
  id: SHAKE_CHALLENGE_ID,
  requires: new Set(["accelerometer"]),
};

export interface ShakeProgressInput {
  /** Magnitude of acceleration delta (device units). */
  readonly motionMagnitude: number;
  readonly elapsedMs: number;
  readonly requiredMs?: number;
  readonly magnitudeThreshold?: number;
}

export interface ShakeProgress {
  readonly complete: boolean;
  readonly activeMs: number;
  readonly requiredMs: number;
}

/**
 * Accumulate "active shaking" time while magnitude exceeds threshold.
 * Caller supplies per-tick magnitude and total elapsed wall time is not used for completion—
 * pass cumulative activeMs via repeated calls by tracking outside, or use this helper per tick
 * with running activeMs.
 */
export function advanceShakeProgress(
  previousActiveMs: number,
  tick: { magnitude: number; deltaMs: number; magnitudeThreshold?: number; requiredMs?: number },
): ShakeProgress {
  const magnitudeThreshold = tick.magnitudeThreshold ?? 1.2;
  const requiredMs = tick.requiredMs ?? 5_000;
  const activeMs =
    tick.magnitude >= magnitudeThreshold
      ? previousActiveMs + tick.deltaMs
      : previousActiveMs;
  return {
    complete: activeMs >= requiredMs,
    activeMs,
    requiredMs,
  };
}
