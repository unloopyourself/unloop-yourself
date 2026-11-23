import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import {
  advanceRotateYawProgress,
  createRotateYawState,
} from "@unloop/core";
import type { Translate } from "../i18n";
import {
  subscribeAccelerometerRaw,
  subscribeGyroscopeYaw,
} from "../expoSensorPort";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
  /** Gyro → yaw away/back; otherwise portrait↔landscape fallback. */
  hasGyro?: boolean;
};

type Pose = "portrait" | "landscape";
type Step = "away" | "back" | "done";

/** Inclusive random integer in [min, max]. */
export function randomRotateCycles(min = 3, max = 7): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function poseFromAccel(ax: number, ay: number, prev: Pose | null): Pose {
  const axa = Math.abs(ax);
  const aya = Math.abs(ay);
  // Hysteresis so borderline tilt does not chatter.
  if (axa > aya * 1.25) {
    return "landscape";
  }
  if (aya > axa * 1.25) {
    return "portrait";
  }
  return prev ?? (axa > aya ? "landscape" : "portrait");
}

/**
 * Reorient away then back, repeated 3–7 times.
 * - With gyro: world-up yaw (~75° out, back near start).
 * - Without: portrait ↔ landscape from accelerometer.
 */
export function RotatePhoneChallenge({
  t,
  onComplete,
  hasGyro = false,
}: Props) {
  const requiredCycles = useMemo(() => randomRotateCycles(3, 7), []);
  const [step, setStep] = useState<Step>("away");
  const [cyclesDone, setCyclesDone] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let finished = false;

    if (hasGyro) {
      let state = createRotateYawState();
      const { stop } = subscribeGyroscopeYaw((yawRate, deltaMs) => {
        if (finished) {
          return;
        }
        const progress = advanceRotateYawProgress(state, {
          yawRateRadPerSec: yawRate,
          deltaMs,
          requiredCycles,
        });
        state = {
          step: progress.step,
          netYawRad: progress.netYawRad,
          cyclesDone: progress.cyclesDone,
        };
        setStep(progress.step);
        setCyclesDone(progress.cyclesDone);
        if (progress.complete) {
          finished = true;
          setStep("done");
          stop();
          queueMicrotask(() => onCompleteRef.current());
        }
      });
      return () => stop();
    }

    let stepLocal: Step = "away";
    let cyclesLocal = 0;
    let startPose: Pose | null = null;
    let prevPose: Pose | null = null;
    const { stop } = subscribeAccelerometerRaw((ax, ay) => {
      if (finished) {
        return;
      }
      const pose = poseFromAccel(ax, ay, prevPose);
      prevPose = pose;
      if (startPose == null) {
        startPose = pose;
        return;
      }
      if (stepLocal === "away" && pose !== startPose) {
        stepLocal = "back";
        setStep("back");
        return;
      }
      if (stepLocal === "back" && pose === startPose) {
        cyclesLocal += 1;
        setCyclesDone(cyclesLocal);
        if (cyclesLocal >= requiredCycles) {
          finished = true;
          stepLocal = "done";
          setStep("done");
          stop();
          queueMicrotask(() => onCompleteRef.current());
          return;
        }
        stepLocal = "away";
        setStep("away");
      }
    }, 80);
    return () => stop();
  }, [hasGyro, requiredCycles]);

  return (
    <View style={styles.wrap} accessibilityLabel="Rotate phone challenge">
      <Text style={styles.title}>{t("challenge.rotate.title")}</Text>
      <Text style={styles.subtitle}>
        {step === "done"
          ? t("challenge.rotate.done")
          : step === "away"
            ? t("challenge.rotate.away", { n: requiredCycles - cyclesDone })
            : t("challenge.rotate.back", { n: requiredCycles - cyclesDone })}
      </Text>
      <Text style={styles.meta}>
        {step === "done"
          ? "✓"
          : t("challenge.rotate.progress", {
              done: cyclesDone,
              total: requiredCycles,
            })}
      </Text>
    </View>
  );
}
