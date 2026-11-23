/** Rotate phone: away then back — yaw (preferred) or pose flip (accel-only). */

export const ROTATE_PHONE_CHALLENGE_ID = "rotate_phone" as const;

/** ~75° away from start before counting “away”. */
export const ROTATE_AWAY_RAD = (75 * Math.PI) / 180;

/** Must return within ~30° of start to count “back”. */
export const ROTATE_BACK_RAD = (30 * Math.PI) / 180;

export type RotateYawStep = "away" | "back";

export type RotateYawState = {
  readonly step: RotateYawStep;
  readonly netYawRad: number;
  readonly cyclesDone: number;
};

export type RotateYawProgress = RotateYawState & {
  readonly complete: boolean;
  readonly requiredCycles: number;
};

/**
 * Integrate signed world-up yaw. Away = |net| ≥ away threshold; back = |net|
 * ≤ back threshold. Each completed away→back increments a cycle.
 */
export function advanceRotateYawProgress(
  state: RotateYawState,
  tick: {
    yawRateRadPerSec: number;
    deltaMs: number;
    requiredCycles: number;
    awayRad?: number;
    backRad?: number;
    minRateRadPerSec?: number;
  },
): RotateYawProgress {
  const awayRad = tick.awayRad ?? ROTATE_AWAY_RAD;
  const backRad = tick.backRad ?? ROTATE_BACK_RAD;
  const minRate = tick.minRateRadPerSec ?? 0.35;
  const rate = tick.yawRateRadPerSec;
  const delta =
    Math.abs(rate) >= minRate ? rate * (tick.deltaMs / 1000) : 0;

  let { step, netYawRad, cyclesDone } = state;
  netYawRad += delta;

  if (step === "away" && Math.abs(netYawRad) >= awayRad) {
    step = "back";
  } else if (step === "back" && Math.abs(netYawRad) <= backRad) {
    cyclesDone += 1;
    netYawRad = 0;
    step = "away";
  }

  return {
    step,
    netYawRad,
    cyclesDone: Math.min(cyclesDone, tick.requiredCycles),
    requiredCycles: tick.requiredCycles,
    complete: cyclesDone >= tick.requiredCycles,
  };
}

export function createRotateYawState(): RotateYawState {
  return { step: "away", netYawRad: 0, cyclesDone: 0 };
}
