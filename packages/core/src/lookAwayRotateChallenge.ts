/** Look-away: net rotation around world-up until ~120° (not 3-axis magnitude). */

export const LOOK_AWAY_CHALLENGE_ID = "look_away" as const;

/** ~120 degrees */
export const LOOK_AWAY_MIN_RAD = (120 * Math.PI) / 180;

export type LookAwayRotateProgress = {
  readonly complete: boolean;
  /** Signed net yaw (rad). UI should show abs. */
  readonly accumulatedRad: number;
  readonly requiredRad: number;
};

/**
 * Integrate signed yaw around vertical. Oscillation cancels; a coherent body
 * turn accumulates. `yawRateRadPerSec` must be the vertical-axis component
 * (not √(x²+y²+z²)).
 */
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
  const minRate = tick.minRateRadPerSec ?? 0.4;
  const rate = tick.yawRateRadPerSec;
  const delta =
    Math.abs(rate) >= minRate ? rate * (tick.deltaMs / 1000) : 0;
  const accumulatedRad = previousRad + delta;
  const capped =
    Math.abs(accumulatedRad) > requiredRad
      ? Math.sign(accumulatedRad) * requiredRad
      : accumulatedRad;
  return {
    complete: Math.abs(accumulatedRad) >= requiredRad,
    accumulatedRad: capped,
    requiredRad,
  };
}
