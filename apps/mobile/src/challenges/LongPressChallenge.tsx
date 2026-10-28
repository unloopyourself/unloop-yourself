import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  advanceCoinSpinProgress,
  challengeProgressDisplayPct,
} from "@unloop/core";
import type { Translate } from "../i18n";
import { subscribeGyroscopeYaw } from "../expoSensorPort";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
};

const REQUIRED_TURNS = 3;
const MIN_HOLD_MS = 4_000;

/**
 * Hold the button while turning in place ~3 rotations (gyro) — longer than a tap.
 */
export function LongPressChallenge({ t, onComplete }: Props) {
  const [heldMs, setHeldMs] = useState(0);
  const [turns, setTurns] = useState(0);
  const holdingRef = useRef(false);
  const heldMsRef = useRef(0);
  const startRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let accumulated = 0;
    const { stop } = subscribeGyroscopeYaw((yawRate, deltaMs) => {
      if (doneRef.current || !holdingRef.current) {
        return;
      }
      const progress = advanceCoinSpinProgress(accumulated, {
        yawRateRadPerSec: yawRate,
        deltaMs,
        requiredTurns: REQUIRED_TURNS,
        minRateRadPerSec: 0.4,
      });
      accumulated = progress.accumulatedRad;
      setTurns(progress.turns);
      if (
        progress.complete &&
        heldMsRef.current >= MIN_HOLD_MS &&
        !doneRef.current
      ) {
        doneRef.current = true;
        stop();
        queueMicrotask(() => onCompleteRef.current());
      }
    });
    return () => stop();
  }, []);

  const clearTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    startRef.current = null;
  };

  const onPressIn = () => {
    if (doneRef.current) {
      return;
    }
    holdingRef.current = true;
    startRef.current = Date.now();
    tickRef.current = setInterval(() => {
      if (startRef.current == null || doneRef.current) {
        return;
      }
      const ms = Date.now() - startRef.current;
      heldMsRef.current = ms;
      setHeldMs(ms);
    }, 50);
  };

  const onPressOut = () => {
    if (doneRef.current) {
      return;
    }
    holdingRef.current = false;
    clearTick();
    heldMsRef.current = 0;
    setHeldMs(0);
  };

  const holdPct = challengeProgressDisplayPct(
    heldMs,
    MIN_HOLD_MS,
    heldMs >= MIN_HOLD_MS,
  );
  const turnPct = challengeProgressDisplayPct(
    turns,
    REQUIRED_TURNS,
    turns >= REQUIRED_TURNS,
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.long_press.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.long_press.body")}</Text>
      <Text style={styles.meta}>
        {t("challenge.long_press.progress", {
          turns: Math.min(REQUIRED_TURNS, Math.floor(turns * 10) / 10),
          need: REQUIRED_TURNS,
        })}
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(holdPct, turnPct)}%` }]} />
      </View>
      <Pressable
        style={styles.btn}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel="Long press hold"
        testID="long-press"
      >
        <Text style={styles.btnLabel}>{t("challenge.long_press.hold")}</Text>
      </Pressable>
    </View>
  );
}
