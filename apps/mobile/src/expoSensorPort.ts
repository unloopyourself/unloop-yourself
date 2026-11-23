import { Accelerometer, Gyroscope } from "expo-sensors";
import {
  createGravityState,
  updateGravity,
  yawRateAroundGravity,
  type Capability,
  type GravityState,
  type SensorPort,
  type SensorReading,
} from "@unloop/core";

export class ExpoSensorPort implements SensorPort {
  async isAvailable(capability: Capability): Promise<boolean> {
    if (capability === "accelerometer") {
      return Accelerometer.isAvailableAsync();
    }
    if (capability === "gyroscope") {
      return Gyroscope.isAvailableAsync();
    }
    return false;
  }

  async read(capability: Capability): Promise<SensorReading | null> {
    if (capability === "accelerometer") {
      const available = await Accelerometer.isAvailableAsync();
      if (!available) {
        return null;
      }
      return new Promise((resolve) => {
        let settled = false;
        Accelerometer.setUpdateInterval(100);
        const sub = Accelerometer.addListener(({ x, y, z }) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          sub.remove();
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          resolve({
            capability: "accelerometer",
            value: magnitude,
            observedAtMs: Date.now(),
          });
        });
        const timer = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          sub.remove();
          resolve(null);
        }, 800);
      });
    }
    if (capability === "gyroscope") {
      const available = await Gyroscope.isAvailableAsync();
      if (!available) {
        return null;
      }
      return new Promise((resolve) => {
        let settled = false;
        Gyroscope.setUpdateInterval(100);
        const sub = Gyroscope.addListener(({ x, y, z }) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          sub.remove();
          const rate = Math.sqrt(x * x + y * y + z * z);
          resolve({
            capability: "gyroscope",
            value: rate,
            observedAtMs: Date.now(),
          });
        });
        // Avoid a stuck listener if the OEM never delivers a sample (blocks later
        // subscriptions on some Samsung devices).
        const timer = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          sub.remove();
          resolve(null);
        }, 800);
      });
    }
    return null;
  }
}

export type MotionSampleHandler = (magnitude: number, deltaMs: number) => void;

export type AccelSampleHandler = (
  ax: number,
  ay: number,
  az: number,
  deltaMs: number,
) => void;

/** Continuous accelerometer stream for ShakeChallenge UI. */
export function subscribeAccelerometer(
  onSample: MotionSampleHandler,
  intervalMs = 100,
): { stop: () => void } {
  return subscribeAccelerometerRaw((ax, ay, az, deltaMs) => {
    const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);
    onSample(Math.abs(magnitude - 1), deltaMs);
  }, intervalMs);
}

/** Raw accelerometer stream for air-write plane tracking. */
export function subscribeAccelerometerRaw(
  onSample: AccelSampleHandler,
  intervalMs = 50,
): { stop: () => void } {
  let lastMs = Date.now();
  Accelerometer.setUpdateInterval(intervalMs);
  const sub = Accelerometer.addListener(({ x, y, z }) => {
    const now = Date.now();
    const deltaMs = Math.max(1, now - lastMs);
    lastMs = now;
    onSample(x, y, z, deltaMs);
  });
  return {
    stop: () => {
      sub.remove();
    },
  };
}

export type YawSampleHandler = (
  yawRateRadPerSec: number,
  deltaMs: number,
) => void;

export type AccelGyroSampleHandler = (
  ax: number,
  ay: number,
  az: number,
  gyroRate: number,
  deltaMs: number,
) => void;

/**
 * Accel stream with optional gyro rate magnitude (0 when gyro unavailable).
 * Used by progressive-enhancement challenges (stand_up, hold_still).
 */
export function subscribeAccelWithOptionalGyro(
  onSample: AccelGyroSampleHandler,
  opts: { intervalMs?: number; useGyro: boolean } = { useGyro: false },
): { stop: () => void } {
  const intervalMs = opts.intervalMs ?? 50;
  let lastMs = Date.now();
  let gyroRate = 0;
  let stopped = false;
  let gyroSub: { remove: () => void } | null = null;

  Accelerometer.setUpdateInterval(intervalMs);
  const accelSub = Accelerometer.addListener(({ x, y, z }) => {
    if (stopped) {
      return;
    }
    const now = Date.now();
    const deltaMs = Math.max(1, now - lastMs);
    lastMs = now;
    onSample(x, y, z, gyroRate, deltaMs);
  });

  if (opts.useGyro) {
    const attachTimer = setTimeout(() => {
      if (stopped) {
        return;
      }
      Gyroscope.setUpdateInterval(intervalMs);
      gyroSub = Gyroscope.addListener(({ x, y, z }) => {
        if (stopped) {
          return;
        }
        gyroRate = Math.sqrt(x * x + y * y + z * z);
      });
    }, 120);
    return {
      stop: () => {
        stopped = true;
        clearTimeout(attachTimer);
        accelSub.remove();
        gyroSub?.remove();
        gyroSub = null;
      },
    };
  }

  return {
    stop: () => {
      stopped = true;
      accelSub.remove();
    },
  };
}

export type WorldYawOptions = {
  intervalMs?: number;
  /**
   * After gravity is primed, freeze it after this many ms so fast spins
   * (coin on table) do not corrupt the world-up estimate.
   * Omit for look_away (body turn — keep gravity live).
   */
  lockGravityAfterMs?: number;
};

/**
 * World-up yaw rate (signed, rad/s) from accel gravity + gyro.
 * Used by look_away, coin_spin, long_press — not 3-axis magnitude.
 */
export function subscribeGyroscopeYaw(
  onSample: YawSampleHandler,
  opts: WorldYawOptions | number = {},
): { stop: () => void } {
  // Back-compat: second arg used to be intervalMs number.
  const options: WorldYawOptions =
    typeof opts === "number" ? { intervalMs: opts } : opts;
  const intervalMs = options.intervalMs ?? 50;
  const lockAfter = options.lockGravityAfterMs;

  let lastMs = Date.now();
  let stopped = false;
  let gravity: GravityState = createGravityState();
  let gravityLocked = false;
  let primedAtMs: number | null = null;
  let latestGyro = { x: 0, y: 0, z: 0 };
  let gyroReady = false;
  let accelSub: { remove: () => void } | null = null;
  let gyroSub: { remove: () => void } | null = null;

  // Defer attach so a remount after Open can release the previous OEM handle
  // (Samsung SensorManager often fails immediate re-register).
  const attachTimer = setTimeout(() => {
    if (stopped) {
      return;
    }
    Accelerometer.setUpdateInterval(intervalMs);
    Gyroscope.setUpdateInterval(intervalMs);

    gyroSub = Gyroscope.addListener(({ x, y, z }) => {
      if (stopped) {
        return;
      }
      latestGyro = { x, y, z };
      gyroReady = true;
    });

    accelSub = Accelerometer.addListener(({ x, y, z }) => {
      if (stopped || !gyroReady) {
        return;
      }
      const now = Date.now();
      const deltaMs = Math.max(1, now - lastMs);
      lastMs = now;

      if (!gravityLocked) {
        gravity = updateGravity(gravity, x, y, z, 0.92);
        if (gravity.primed && primedAtMs == null) {
          primedAtMs = now;
        }
        if (
          lockAfter != null &&
          primedAtMs != null &&
          now - primedAtMs >= lockAfter
        ) {
          gravityLocked = true;
        }
      }

      if (!gravity.primed) {
        return;
      }

      // Flat on a table: phone Z ≈ world up — prefer that axis (stable while spinning).
      const gMag = Math.sqrt(
        gravity.gx * gravity.gx +
          gravity.gy * gravity.gy +
          gravity.gz * gravity.gz,
      );
      const uz = gMag > 0.2 ? gravity.gz / gMag : 0;
      const yaw =
        Math.abs(uz) > 0.75
          ? latestGyro.z * Math.sign(uz || 1)
          : yawRateAroundGravity(
              latestGyro.x,
              latestGyro.y,
              latestGyro.z,
              gravity,
            );
      onSample(yaw, deltaMs);
    });
  }, 120);

  return {
    stop: () => {
      stopped = true;
      clearTimeout(attachTimer);
      accelSub?.remove();
      gyroSub?.remove();
      accelSub = null;
      gyroSub = null;
    },
  };
}
