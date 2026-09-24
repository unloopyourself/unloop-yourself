import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { advanceShakeProgress, challengeProgressDisplayPct } from "@unloop/core";
import type { Translate } from "../i18n";
import { subscribeAccelerometer } from "../expoSensorPort";
import { colors, typography } from "../theme";

type Props = {
  t: Translate;
  onComplete: () => void;
};

const REQUIRED_MS = 5_000;

export function ShakeChallengeBody({ t, onComplete }: Props) {
  const [activeMs, setActiveMs] = useState(0);
  const [done, setDone] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let current = 0;
    let finished = false;
    const { stop } = subscribeAccelerometer((magnitude, deltaMs) => {
      if (finished) {
        return;
      }
      const progress = advanceShakeProgress(current, {
        magnitude,
        deltaMs,
        requiredMs: REQUIRED_MS,
        magnitudeThreshold: 0.6,
      });
      current = progress.activeMs;
      setActiveMs(progress.activeMs);
      if (progress.complete) {
        finished = true;
        stop();
        setDone(true);
        queueMicrotask(() => onCompleteRef.current());
      }
    });
    return () => stop();
  }, []);

  const pct = challengeProgressDisplayPct(activeMs, REQUIRED_MS, done);

  return (
    <View style={styles.wrap} accessibilityLabel="Shake challenge">
      <Text style={styles.title}>{t("challenge.shake.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.shake.body")}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.meta}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
    gap: 14,
    paddingVertical: 8,
  },
  title: {
    fontSize: typography.titleSize,
    fontWeight: "800",
    color: colors.white,
  },
  subtitle: {
    fontSize: typography.bodySize,
    lineHeight: 24,
    textAlign: "center",
    color: colors.textOnInk,
    opacity: 0.92,
  },
  barTrack: {
    width: "100%",
    height: 14,
    backgroundColor: colors.inkSoft,
    borderRadius: 8,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.ember,
  },
  meta: {
    fontSize: typography.metaSize,
    fontWeight: "600",
    color: colors.emberSoft,
  },
});
