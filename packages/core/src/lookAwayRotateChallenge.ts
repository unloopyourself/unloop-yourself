/** Look-away: accumulate absolute yaw until a minimum turn (radians). */

export const LOOK_AWAY_CHALLENGE_ID = "look_away" as const;

/** ~120 degrees */
export const LOOK_AWAY_MIN_RAD = (120 * Math.PI) / 180;

export type LookAwayRotateProgress = {
  readonly complete: boolean;
  readonly accumulatedRad: number;
  readonly requiredRad: number;
};

export function advanceLookAwayRotateProgress(
  previousRad: number,
  tick: {
    yawRateRadPerSec: number;
    deltaMs: number;
    requiredRad?: number;
    minRateRadPerSec?: number;
  },
): LookAwayRotateProgress {
  const requiredRad = tick.requiredRad ?? LOOK_AWAY_MIN_RAD;
  const minRate = tick.minRateRadPerSec ?? 0.25;
  const rate = Math.abs(tick.yawRateRadPerSec);
  const delta =
    rate >= minRate ? rate * (tick.deltaMs / 1000) : 0;
  const accumulatedRad = previousRad + delta;
  return {
    complete: accumulatedRad >= requiredRad,
    accumulatedRad: Math.min(accumulatedRad, requiredRad),
    requiredRad,
  };
}
