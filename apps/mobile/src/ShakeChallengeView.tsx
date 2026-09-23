import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { advanceShakeProgress } from "@unloop/core";
import { subscribeAccelerometer } from "./expoSensorPort";
import { colors, typography } from "./theme";

type Props = {
  onComplete: () => void;
};

const REQUIRED_MS = 5_000;

export function ShakeChallengeView({ onComplete }: Props) {
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
        // Defer so the 100% paint lands before parent unmounts this view.
        queueMicrotask(() => {
          onCompleteRef.current();
        });
      }
    });
    return () => {
      stop();
    };
  }, []);

  // Never show 100% until the challenge actually completed (Math.round lied).
  const pct = done
    ? 100
    : Math.min(99, Math.floor((activeMs / REQUIRED_MS) * 100));

  return (
    <View style={styles.wrap} accessibilityLabel="Shake challenge">
      <Text style={styles.title}>Shake to come back</Text>
      <Text style={styles.subtitle}>
        You asked me to interrupt. Move your body for a few seconds — scrolling
        can’t do that for you.
      </Text>
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
    paddingVertical: 16,
  },
  title: {
    fontSize: typography.titleSize,
    fontWeight: "800",
    color: colors.white,
  },
  subtitle: {
    fontSize: typography.bodySize,
    fontWeight: "400",
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
