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
        Accelerometer.setUpdateInterval(100);
        const sub = Accelerometer.addListener(({ x, y, z }) => {
          sub.remove();
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          resolve({
            capability: "accelerometer",
            value: magnitude,
            observedAtMs: Date.now(),
          });
        });
      });
    }
    if (capability === "gyroscope") {
      const available = await Gyroscope.isAvailableAsync();
      if (!available) {
        return null;
      }
      return new Promise((resolve) => {
        Gyroscope.setUpdateInterval(100);
        const sub = Gyroscope.addListener(({ z }) => {
          sub.remove();
          resolve({
            capability: "gyroscope",
            value: Math.abs(z),
            observedAtMs: Date.now(),
          });
        });
      });
    }
    return null;
  }
}

export type MotionSampleHandler = (magnitude: number, deltaMs: number) => void;

/** Continuous accelerometer stream for ShakeChallenge UI. */
export function subscribeAccelerometer(
  onSample: MotionSampleHandler,
  intervalMs = 100,
): { stop: () => void } {
  let lastMs = Date.now();
  Accelerometer.setUpdateInterval(intervalMs);
  const sub = Accelerometer.addListener(({ x, y, z }) => {
    const now = Date.now();
    const deltaMs = now - lastMs;
    lastMs = now;
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    // Gravity ~1g; use deviation from rest as motion signal.
    onSample(Math.abs(magnitude - 1), deltaMs);
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

/** Continuous gyroscope Z stream for CoinSpin (face-up yaw). */
export function subscribeGyroscopeYaw(
  onSample: YawSampleHandler,
  intervalMs = 50,
): { stop: () => void } {
  let lastMs = Date.now();
  Gyroscope.setUpdateInterval(intervalMs);
  const sub = Gyroscope.addListener(({ z }) => {
    const now = Date.now();
    const deltaMs = Math.max(1, now - lastMs);
    lastMs = now;
    onSample(z, deltaMs);
  });
  return {
    stop: () => {
      sub.remove();
    },
  };
}
