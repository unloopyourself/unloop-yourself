import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  advanceCoinSpinProgress,
  challengeProgressDisplayPct,
} from "@unloop/core";
import type { Translate } from "../i18n";
import { subscribeGyroscopeYaw } from "../expoSensorPort";
import { colors, typography } from "../theme";

type Props = {
  t: Translate;
  onComplete: () => void;
};

const REQUIRED_TURNS = 5;

export function CoinSpinChallenge({ t, onComplete }: Props) {
  const [turns, setTurns] = useState(0);
  const [done, setDone] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let accumulated = 0;
    let finished = false;
    const { stop } = subscribeGyroscopeYaw((yawRate, deltaMs) => {
      if (finished) {
        return;
      }
      const progress = advanceCoinSpinProgress(accumulated, {
        yawRateRadPerSec: yawRate,
        deltaMs,
        requiredTurns: REQUIRED_TURNS,
      });
      accumulated = progress.accumulatedRad;
      setTurns(progress.turns);
      if (progress.complete) {
        finished = true;
        stop();
        setDone(true);
        queueMicrotask(() => onCompleteRef.current());
      }
    });
    return () => stop();
  }, []);

  const pct = challengeProgressDisplayPct(
    turns,
    REQUIRED_TURNS,
    done,
  );

  return (
    <View style={styles.wrap} accessibilityLabel="Coin spin challenge">
      <Text style={styles.title}>{t("challenge.coin.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.coin.body")}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.meta}>
        {Math.min(REQUIRED_TURNS, Math.floor(turns * 10) / 10)} / {REQUIRED_TURNS}
      </Text>
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
