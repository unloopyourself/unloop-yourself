import { useEffect, useRef, useState } from "react";
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

function poseFromAccel(ax: number, ay: number): Pose {
  return Math.abs(ax) > Math.abs(ay) ? "landscape" : "portrait";
}

/** Reorient the device once away from start pose, then back — breaks thumb scroll. */
export function RotatePhoneChallenge({ t, onComplete }: Props) {
  const [step, setStep] = useState<Step>("away");
  const stepRef = useRef<Step>("away");
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
        finished = true;
        stepRef.current = "done";
        setStep("done");
        stop();
        queueMicrotask(() => onCompleteRef.current());
      }
    }, 80);
    return () => stop();
  }, []);

  return (
    <View style={styles.wrap} accessibilityLabel="Rotate phone challenge">
      <Text style={styles.title}>{t("challenge.rotate.title")}</Text>
      <Text style={styles.subtitle}>
        {step === "away"
          ? t("challenge.rotate.away")
          : t("challenge.rotate.back")}
      </Text>
      <Text style={styles.meta}>
        {step === "away" ? "1 / 2" : step === "back" ? "2 / 2" : "✓"}
      </Text>
    </View>
  );
}
