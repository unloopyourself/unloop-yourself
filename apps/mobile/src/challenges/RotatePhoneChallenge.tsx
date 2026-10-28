import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import type { Translate } from "../i18n";
import { subscribeAccelerometerRaw } from "../expoSensorPort";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
};

type Pose = "portrait" | "landscape";
type Step = "away" | "back" | "done";

/** Inclusive random integer in [min, max]. */
export function randomRotateCycles(min = 3, max = 7): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function poseFromAccel(ax: number, ay: number): Pose {
  return Math.abs(ax) > Math.abs(ay) ? "landscape" : "portrait";
}

/**
 * Reorient away from the start pose, then back — repeated a random number of
 * times (3–7) so one casual flip is not enough to dismiss.
 */
export function RotatePhoneChallenge({ t, onComplete }: Props) {
  const requiredCycles = useMemo(() => randomRotateCycles(3, 7), []);
  const [step, setStep] = useState<Step>("away");
  const [cyclesDone, setCyclesDone] = useState(0);
  const stepRef = useRef<Step>("away");
  const cyclesDoneRef = useRef(0);
  const startRef = useRef<Pose | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let finished = false;
    const { stop } = subscribeAccelerometerRaw((ax, ay) => {
      if (finished) {
        return;
      }
      const pose = poseFromAccel(ax, ay);
      if (startRef.current == null) {
        startRef.current = pose;
        return;
      }
      const current = stepRef.current;
      if (current === "away" && pose !== startRef.current) {
        stepRef.current = "back";
        setStep("back");
        return;
      }
      if (current === "back" && pose === startRef.current) {
        const next = cyclesDoneRef.current + 1;
        cyclesDoneRef.current = next;
        setCyclesDone(next);
        if (next >= requiredCycles) {
          finished = true;
          stepRef.current = "done";
          setStep("done");
          stop();
          queueMicrotask(() => onCompleteRef.current());
          return;
        }
        stepRef.current = "away";
        setStep("away");
      }
    }, 80);
    return () => stop();
  }, [requiredCycles]);

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
