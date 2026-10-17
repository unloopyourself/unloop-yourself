import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import {
  advanceHoldStillProgress,
  challengeProgressDisplayPct,
} from "@unloop/core";
import type { Translate } from "../i18n";
import { subscribeAccelerometerRaw } from "../expoSensorPort";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
};

const REQUIRED_MS = 2500;

export function HoldStillChallenge({ t, onComplete }: Props) {
  const [heldMs, setHeldMs] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let held = 0;
    let prevMag = 1;
    let finished = false;
    const { stop } = subscribeAccelerometerRaw((ax, ay, az, deltaMs) => {
      if (finished) {
        return;
      }
      const mag = Math.sqrt(ax * ax + ay * ay + az * az);
      const progress = advanceHoldStillProgress(held, {
        deviation: Math.abs(mag - 1),
        jerk: Math.abs(mag - prevMag),
        deltaMs,
        requiredMs: REQUIRED_MS,
      });
      prevMag = mag;
      held = progress.heldMs;
      setHeldMs(held);
      if (progress.complete) {
        finished = true;
        stop();
        queueMicrotask(() => onCompleteRef.current());
      }
    }, 50);
    return () => stop();
  }, []);

  const pct = challengeProgressDisplayPct(heldMs, REQUIRED_MS, heldMs >= REQUIRED_MS);

  return (
    <View style={styles.wrap} accessibilityLabel="Hold still challenge">
      <Text style={styles.title}>{t("challenge.hold_still.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.hold_still.body")}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.meta}>{Math.round(heldMs / 100) / 10}s</Text>
    </View>
  );
}
