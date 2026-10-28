import { Accelerometer, Gyroscope } from "expo-sensors";
import type { Capability, SensorPort, SensorReading } from "@unloop/core";

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

/**
 * Continuous gyroscope stream for CoinSpin.
 * Uses full angular-rate magnitude so OEM axis mapping (Z vs X/Y when flat)
 * does not leave the counter stuck at 0.
 */
export function subscribeGyroscopeYaw(
  onSample: YawSampleHandler,
  intervalMs = 50,
): { stop: () => void } {
  let lastMs = Date.now();
  let stopped = false;
  let sub: { remove: () => void } | null = null;
  // Defer attach so a remount after Open can release the previous OEM handle
  // (Samsung SensorManager often fails immediate re-register).
  const attachTimer = setTimeout(() => {
    if (stopped) {
      return;
    }
    Gyroscope.setUpdateInterval(intervalMs);
    sub = Gyroscope.addListener(({ x, y, z }) => {
      if (stopped) {
        return;
      }
      const now = Date.now();
      const deltaMs = Math.max(1, now - lastMs);
      lastMs = now;
      onSample(Math.sqrt(x * x + y * y + z * z), deltaMs);
    });
  }, 120);
  return {
    stop: () => {
      stopped = true;
      clearTimeout(attachTimer);
      sub?.remove();
      sub = null;
    },
  };
}
