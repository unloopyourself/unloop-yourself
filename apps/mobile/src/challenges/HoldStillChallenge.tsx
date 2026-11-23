import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import {
  advanceHoldStillProgress,
  challengeProgressDisplayPct,
} from "@unloop/core";
import type { Translate } from "../i18n";
import { subscribeAccelWithOptionalGyro } from "../expoSensorPort";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
  /** When true, micro-rotations (gyro) also reset the hold. */
  hasGyro?: boolean;
};

/** Real stillness via accelerometer (± gyro). Not a timer alone. */
const REQUIRED_MS = 5_000;

export function HoldStillChallenge({ t, onComplete, hasGyro = false }: Props) {
  const [heldMs, setHeldMs] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let held = 0;
    let prevMag = 1;
    let finished = false;
    const { stop } = subscribeAccelWithOptionalGyro(
      (ax, ay, az, gyroRate, deltaMs) => {
        if (finished) {
          return;
        }
        const mag = Math.sqrt(ax * ax + ay * ay + az * az);
        const progress = advanceHoldStillProgress(held, {
          deviation: Math.abs(mag - 1),
          jerk: Math.abs(mag - prevMag),
          deltaMs,
          requiredMs: REQUIRED_MS,
          ...(hasGyro ? { gyroRate } : {}),
        });
        prevMag = mag;
        held = progress.heldMs;
        setHeldMs(held);
        if (progress.complete) {
          finished = true;
          stop();
          queueMicrotask(() => onCompleteRef.current());
        }
      },
      { intervalMs: 50, useGyro: hasGyro },
    );
    return () => stop();
  }, [hasGyro]);

  const pct = challengeProgressDisplayPct(heldMs, REQUIRED_MS, heldMs >= REQUIRED_MS);

  return (
    <View style={styles.wrap} accessibilityLabel="Hold still challenge">
      <Text style={styles.title}>{t("challenge.hold_still.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.hold_still.body")}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.meta}>{Math.round(heldMs / 100) / 10}s / 5s</Text>
    </View>
  );
}
