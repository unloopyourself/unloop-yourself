import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { challengeProgressDisplayPct } from "@unloop/core";
import type { Translate } from "../i18n";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
};

const HOLD_MS = 2500;

export function LongPressChallenge({ t, onComplete }: Props) {
  const [heldMs, setHeldMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

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
    startRef.current = Date.now();
    tickRef.current = setInterval(() => {
      if (startRef.current == null || doneRef.current) {
        return;
      }
      const ms = Date.now() - startRef.current;
      setHeldMs(ms);
      if (ms >= HOLD_MS) {
        doneRef.current = true;
        clearTick();
        setHeldMs(HOLD_MS);
        onComplete();
      }
    }, 50);
  };

  const onPressOut = () => {
    if (doneRef.current) {
      return;
    }
    clearTick();
    setHeldMs(0);
  };

  const pct = challengeProgressDisplayPct(heldMs, HOLD_MS, heldMs >= HOLD_MS);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.long_press.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.long_press.body")}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
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
