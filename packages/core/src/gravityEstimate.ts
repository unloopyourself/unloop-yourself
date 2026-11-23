/**
 * Low-pass gravity estimate from accelerometer (no gyroscope required).
 * When still, the accel vector ≈ gravity; during motion the filter lags so
 * accel − gravity ≈ linear acceleration.
 */

export type GravityState = {
  readonly gx: number;
  readonly gy: number;
  readonly gz: number;
  readonly primed: boolean;
};

export function createGravityState(): GravityState {
  return { gx: 0, gy: 0, gz: 1, primed: false };
}

/**
 * @param alpha High = trust previous gravity more (0.85–0.95 typical).
 */
export function updateGravity(
  state: GravityState,
  ax: number,
  ay: number,
  az: number,
  alpha = 0.9,
): GravityState {
  if (!state.primed) {
    return { gx: ax, gy: ay, gz: az, primed: true };
  }
  return {
    gx: alpha * state.gx + (1 - alpha) * ax,
    gy: alpha * state.gy + (1 - alpha) * ay,
    gz: alpha * state.gz + (1 - alpha) * az,
    primed: true,
  };
}

/** Unit gravity direction; falls back to +Z if magnitude is tiny. */
export function gravityUnit(state: GravityState): {
  ux: number;
  uy: number;
  uz: number;
} {
  const mag = Math.sqrt(
    state.gx * state.gx + state.gy * state.gy + state.gz * state.gz,
  );
  if (mag < 0.2) {
    return { ux: 0, uy: 0, uz: 1 };
  }
  return {
    ux: state.gx / mag,
    uy: state.gy / mag,
    uz: state.gz / mag,
  };
}

/**
 * Linear acceleration along the world-up axis (signed).
 * Positive ≈ accelerating against gravity (e.g. standing up).
 */
export function verticalLinearAccel(
  ax: number,
  ay: number,
  az: number,
  gravity: GravityState,
): number {
  const { ux, uy, uz } = gravityUnit(gravity);
  const lx = ax - gravity.gx;
  const ly = ay - gravity.gy;
  const lz = az - gravity.gz;
  return lx * ux + ly * uy + lz * uz;
}

/**
 * Gyroscope angular rate around world-up (signed, rad/s).
 * Positive sense is arbitrary; look-away uses net signed yaw, coin-spin uses |rate|.
 */
export function yawRateAroundGravity(
  wx: number,
  wy: number,
  wz: number,
  gravity: GravityState,
): number {
  const { ux, uy, uz } = gravityUnit(gravity);
  return wx * ux + wy * uy + wz * uz;
}
