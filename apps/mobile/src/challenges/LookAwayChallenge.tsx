import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import {
  LOOK_AWAY_MIN_RAD,
  advanceLookAwayRotateProgress,
  challengeProgressDisplayPct,
} from "@unloop/core";
import type { Translate } from "../i18n";
import { subscribeGyroscopeYaw } from "../expoSensorPort";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
};

/** Look behind you and point the phone that way — ≥120° yaw via gyroscope. */
export function LookAwayChallenge({ t, onComplete }: Props) {
  const [rad, setRad] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let accumulated = 0;
    let finished = false;
    const { stop } = subscribeGyroscopeYaw((yawRate, deltaMs) => {
      if (finished) {
        return;
      }
      const progress = advanceLookAwayRotateProgress(accumulated, {
        yawRateRadPerSec: yawRate,
        deltaMs,
        requiredRad: LOOK_AWAY_MIN_RAD,
      });
      accumulated = progress.accumulatedRad;
      setRad(accumulated);
      if (progress.complete) {
        finished = true;
        stop();
        queueMicrotask(() => onCompleteRef.current());
      }
    });
    return () => stop();
  }, []);

  const deg = Math.round((rad * 180) / Math.PI);
  const need = Math.round((LOOK_AWAY_MIN_RAD * 180) / Math.PI);
  const pct = challengeProgressDisplayPct(rad, LOOK_AWAY_MIN_RAD, rad >= LOOK_AWAY_MIN_RAD);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.look_away.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.look_away.body")}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.meta}>
        {t("challenge.look_away.progress", { deg, need })}
      </Text>
    </View>
  );
}
