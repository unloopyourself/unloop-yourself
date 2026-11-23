/** Count stand/sit motion bursts from accelerometer (± optional gyro assist). */

import {
  createGravityState,
  updateGravity,
  verticalLinearAccel,
  type GravityState,
} from "./gravityEstimate.js";

export const STAND_SIT_CHALLENGE_ID = "stand_up" as const;

export type StandSitMode = "magnitude" | "vertical";

export type StandSitState = {
  readonly bursts: number;
  readonly movingMs: number;
  readonly calmMs: number;
  readonly gravity: GravityState;
  /** Last signed vertical linear accel — used to require direction flips. */
  readonly lastVerticalSign: number;
};

export type StandSitProgress = StandSitState & {
  readonly complete: boolean;
  readonly requiredBursts: number;
  readonly mode: StandSitMode;
};

/**
 * Best-effort stand↔sit counter: after a short calm period, sustained motion
 * counts as one transition. Three transitions ≈ stand/sit/stand.
 *
 * Modes:
 * - `magnitude`: delta-|g| (broadest, noisiest — phones without usable gravity track)
 * - `vertical`: linear accel along gravity; with gyro, high spin without vertical
 *   motion is ignored (rejects “wave the phone” while seated)
 */
export function advanceStandSitProgress(
  state: StandSitState,
  tick: {
    motion: number;
    deltaMs: number;
    requiredBursts?: number;
    motionThreshold?: number;
    minCalmMs?: number;
    minBurstMs?: number;
    mode?: StandSitMode;
  },
): StandSitProgress {
  const requiredBursts = tick.requiredBursts ?? 3;
  const motionThreshold = tick.motionThreshold ?? 0.08;
  const minCalmMs = tick.minCalmMs ?? 220;
  const minBurstMs = tick.minBurstMs ?? 150;
  const mode = tick.mode ?? "magnitude";
  const moving = tick.motion >= motionThreshold;

  let { bursts, movingMs, calmMs, gravity, lastVerticalSign } = state;

  if (moving) {
    if (calmMs < minCalmMs && movingMs === 0 && bursts > 0) {
      // ignore jitter before a real pause between stand/sit
      calmMs = 0;
    } else {
      movingMs += tick.deltaMs;
      calmMs = 0;
    }
  } else {
    if (movingMs >= minBurstMs) {
      bursts += 1;
    }
    movingMs = 0;
    calmMs += tick.deltaMs;
    if (calmMs > minCalmMs * 4) {
      calmMs = minCalmMs * 4;
    }
  }

  return {
    complete: bursts >= requiredBursts,
    bursts: Math.min(bursts, requiredBursts),
    requiredBursts,
    movingMs,
    calmMs,
    gravity,
    lastVerticalSign,
    mode,
  };
}

export type StandSitSampleTick = {
  ax: number;
  ay: number;
  az: number;
  deltaMs: number;
  /** Angular-rate magnitude (rad/s). Omit or 0 when no gyro. */
  gyroRate?: number;
  requiredBursts?: number;
  /** Use vertical gravity path (true) or legacy magnitude (false). */
  useVertical?: boolean;
  /** When gyro is present, ignore motion dominated by spin. */
  useGyroAssist?: boolean;
};

/**
 * One accel (± gyro) sample → stand/sit progress.
 * Prefers world-vertical linear accel; falls back to |g| delta if asked.
 */
export function advanceStandSitFromSample(
  state: StandSitState,
  tick: StandSitSampleTick,
): StandSitProgress {
  const useVertical = tick.useVertical !== false;
  const mag = Math.sqrt(
    tick.ax * tick.ax + tick.ay * tick.ay + tick.az * tick.az,
  );
  const gravity = updateGravity(state.gravity, tick.ax, tick.ay, tick.az);
  const vertical = verticalLinearAccel(tick.ax, tick.ay, tick.az, gravity);
  const gyroRate = tick.gyroRate ?? 0;

  let motion: number;
  let mode: StandSitMode;
  if (useVertical && gravity.primed) {
    mode = "vertical";
    motion = Math.abs(vertical);
    // Gyro assist: spinning the phone in place shouldn't count as stand/sit.
    if (tick.useGyroAssist && gyroRate > 1.8 && motion < 0.2) {
      motion = 0;
    }
  } else {
    mode = "magnitude";
    // Approximate previous |g| from gravity magnitude once primed.
    const gMag = Math.sqrt(
      gravity.gx * gravity.gx + gravity.gy * gravity.gy + gravity.gz * gravity.gz,
    );
    motion = Math.abs(mag - (gravity.primed ? gMag : 1));
  }

  const sign =
    Math.abs(vertical) < 0.05 ? state.lastVerticalSign : Math.sign(vertical);

  const next = advanceStandSitProgress(
    {
      bursts: state.bursts,
      movingMs: state.movingMs,
      calmMs: state.calmMs,
      gravity,
      lastVerticalSign: sign,
    },
    {
      motion,
      deltaMs: tick.deltaMs,
      requiredBursts: tick.requiredBursts,
      // Vertical linear peaks are smaller than raw |g| deltas.
      motionThreshold: mode === "vertical" ? 0.12 : 0.07,
      minCalmMs: mode === "vertical" ? 260 : 220,
      minBurstMs: mode === "vertical" ? 180 : 140,
      mode,
    },
  );

  return { ...next, gravity, lastVerticalSign: sign, mode };
}

export function createStandSitState(): StandSitState {
  return {
    bursts: 0,
    movingMs: 0,
    calmMs: 600,
    gravity: createGravityState(),
    lastVerticalSign: 0,
  };
}
