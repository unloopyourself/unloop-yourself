import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import {
  advanceStandSitFromSample,
  challengeProgressDisplayPct,
  createStandSitState,
  type Capability,
} from "@unloop/core";
import type { Translate } from "../i18n";
import { subscribeAccelWithOptionalGyro } from "../expoSensorPort";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
  /** When true, use vertical gravity path + gyro spin rejection. */
  hasGyro?: boolean;
};

const REQUIRED = 3;

/**
 * Stand up / sit down three times.
 * - Broad path (no gyro): world-vertical linear accel from gravity low-pass.
 * - Advanced (gyro): same vertical path + ignore spin-only phone waving.
 */
export function StandUpChallenge({ t, onComplete, hasGyro = false }: Props) {
  const [bursts, setBursts] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let state = createStandSitState();
    let finished = false;
    const { stop } = subscribeAccelWithOptionalGyro(
      (ax, ay, az, gyroRate, deltaMs) => {
        if (finished) {
          return;
        }
        const progress = advanceStandSitFromSample(state, {
          ax,
          ay,
          az,
          deltaMs,
          gyroRate,
          requiredBursts: REQUIRED,
          useVertical: true,
          useGyroAssist: hasGyro,
        });
        state = {
          bursts: progress.bursts,
          movingMs: progress.movingMs,
          calmMs: progress.calmMs,
          gravity: progress.gravity,
          lastVerticalSign: progress.lastVerticalSign,
        };
        setBursts(progress.bursts);
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

/** Helper for tests / settings hints. */
export function standUpUsesGyro(caps: ReadonlySet<Capability>): boolean {
  return caps.has("gyroscope");
}
