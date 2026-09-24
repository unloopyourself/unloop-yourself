/** MVP Coin spin: accumulate absolute yaw while phone pivots (~5 full turns). */

export const COIN_SPIN_CHALLENGE_ID = "coin_spin" as const;

const TWO_PI = Math.PI * 2;

export interface CoinSpinProgress {
  readonly complete: boolean;
  readonly accumulatedRad: number;
  readonly turns: number;
  readonly requiredTurns: number;
}

/**
 * Integrate |yawRate| over time. Tiny rates are ignored (table noise).
 * `yawRateRadPerSec` is typically gyroscope Z when the device is face-up.
 */
export function advanceCoinSpinProgress(
  previousAccumulatedRad: number,
  tick: {
    yawRateRadPerSec: number;
    deltaMs: number;
    requiredTurns?: number;
    minRateRadPerSec?: number;
  },
): CoinSpinProgress {
  const requiredTurns = tick.requiredTurns ?? 5;
  const minRate = tick.minRateRadPerSec ?? 0.35;
  const rate = Math.abs(tick.yawRateRadPerSec);
  const deltaRad =
    rate >= minRate ? rate * (tick.deltaMs / 1000) : 0;
  const accumulatedRad = previousAccumulatedRad + deltaRad;
  const requiredRad = requiredTurns * TWO_PI;
  return {
    complete: accumulatedRad >= requiredRad,
    accumulatedRad,
    turns: accumulatedRad / TWO_PI,
    requiredTurns,
  };
}
