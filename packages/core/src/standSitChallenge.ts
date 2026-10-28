/** Count stand/sit motion bursts from accelerometer magnitude (no gyro). */

export const STAND_SIT_CHALLENGE_ID = "stand_up" as const;

export type StandSitState = {
  readonly bursts: number;
  readonly movingMs: number;
  readonly calmMs: number;
};

export type StandSitProgress = StandSitState & {
  readonly complete: boolean;
  readonly requiredBursts: number;
};

/**
 * Best-effort stand↔sit counter: after a short calm period, sustained accel
 * change counts as one transition. Three transitions ≈ stand/sit/stand.
 *
 * Uses delta-|g| only (phone tilt while still must not look like motion).
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
  },
): StandSitProgress {
  const requiredBursts = tick.requiredBursts ?? 3;
  const motionThreshold = tick.motionThreshold ?? 0.18;
  const minCalmMs = tick.minCalmMs ?? 280;
  const minBurstMs = tick.minBurstMs ?? 220;
  const moving = tick.motion >= motionThreshold;

  let { bursts, movingMs, calmMs } = state;

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
  };
}

export function createStandSitState(): StandSitState {
  return { bursts: 0, movingMs: 0, calmMs: 600 };
}
