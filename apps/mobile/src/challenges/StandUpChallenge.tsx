import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import {
  advanceStandSitProgress,
  challengeProgressDisplayPct,
  createStandSitState,
} from "@unloop/core";
import type { Translate } from "../i18n";
import { subscribeAccelerometerRaw } from "../expoSensorPort";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
};

const REQUIRED = 3;

/** Stand up / sit down three times — accelerometer |g| deltas only (no gyro). */
export function StandUpChallenge({ t, onComplete }: Props) {
  const [bursts, setBursts] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let state = createStandSitState();
    let prevMag = 1;
    let finished = false;
    const { stop } = subscribeAccelerometerRaw((ax, ay, az, deltaMs) => {
      if (finished) {
        return;
      }
      const mag = Math.sqrt(ax * ax + ay * ay + az * az);
      // Delta-|g| only: holding the phone tilted still must not count as motion.
      const motion = Math.abs(mag - prevMag);
      prevMag = mag;
      const progress = advanceStandSitProgress(state, {
        motion,
        deltaMs,
        requiredBursts: REQUIRED,
        motionThreshold: 0.16,
        minCalmMs: 280,
        minBurstMs: 200,
      });
      state = {
        bursts: progress.bursts,
        movingMs: progress.movingMs,
        calmMs: progress.calmMs,
      };
      setBursts(progress.bursts);
      if (progress.complete) {
        finished = true;
        stop();
        queueMicrotask(() => onCompleteRef.current());
      }
    }, 50);
    return () => stop();
  }, []);

  const pct = challengeProgressDisplayPct(bursts, REQUIRED, bursts >= REQUIRED);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.stand_up.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.stand_up.body")}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.meta}>
        {t("challenge.stand_up.progress", { n: bursts, need: REQUIRED })}
      </Text>
    </View>
  );
}
