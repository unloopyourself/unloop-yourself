import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { advanceShakeProgress } from "@unloop/core";
import { subscribeAccelerometer } from "./expoSensorPort";

type Props = {
  onComplete: () => void;
};

export function ShakeChallengeView({ onComplete }: Props) {
  const [activeMs, setActiveMs] = useState(0);
  const requiredMs = 5_000;

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
        requiredMs,
        magnitudeThreshold: 0.6,
      });
      current = progress.activeMs;
      setActiveMs(progress.activeMs);
      if (progress.complete) {
        finished = true;
        stop();
        onComplete();
      }
    });
    return () => {
      stop();
    };
  }, [onComplete]);

  const ratio = Math.min(1, activeMs / requiredMs);

  return (
    <View style={styles.wrap} accessibilityLabel="Shake challenge">
      <Text style={styles.title}>Shake the phone</Text>
      <Text style={styles.subtitle}>
        You asked me to interrupt. Give it a shake for a few seconds.
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${ratio * 100}%` }]} />
      </View>
      <Text style={styles.meta}>{Math.round(ratio * 100)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a3c34",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: "#24352f",
  },
  barTrack: {
    width: "100%",
    height: 12,
    backgroundColor: "#d5e0db",
    borderRadius: 6,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#1a3c34",
  },
  meta: {
    fontSize: 14,
    color: "#4a635c",
  },
});
