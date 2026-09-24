import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Accelerometer } from "expo-sensors";
import type { Translate } from "../i18n";
import { colors, typography } from "../theme";

type Props = {
  t: Translate;
  onComplete: () => void;
};

type Phase = "wait_down" | "hold" | "flip_window" | "done";

const HOLD_MS = 3_000;
/** Flip must finish within this window after hold ends (±0.5s style). */
const FLIP_WINDOW_MS = 1_000;

function isFaceDown(z: number): boolean {
  return z < -0.65;
}

function isFaceUp(z: number): boolean {
  return z > 0.65;
}

export function FaceDownFlipChallenge({ t, onComplete }: Props) {
  const [label, setLabel] = useState(t("challenge.face.wait"));
  const [holdPct, setHoldPct] = useState(0);
  const phaseRef = useRef<Phase>("wait_down");
  const holdStart = useRef<number | null>(null);
  const windowStart = useRef<number | null>(null);
  const finished = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const tRef = useRef(t);
  onCompleteRef.current = onComplete;
  tRef.current = t;

  useEffect(() => {
    Accelerometer.setUpdateInterval(50);
    const sub = Accelerometer.addListener(({ z }) => {
      if (finished.current) {
        return;
      }
      const now = Date.now();
      const phase = phaseRef.current;
      const tr = tRef.current;

      if (phase === "wait_down") {
        if (isFaceDown(z)) {
          holdStart.current = now;
          phaseRef.current = "hold";
          setLabel(tr("challenge.face.down"));
          setHoldPct(0);
        }
        return;
      }

      if (phase === "hold") {
        if (!isFaceDown(z)) {
          holdStart.current = null;
          phaseRef.current = "wait_down";
          setLabel(tr("challenge.face.wait"));
          setHoldPct(0);
          return;
        }
        const start = holdStart.current ?? now;
        const elapsed = now - start;
        setHoldPct(Math.min(99, Math.floor((elapsed / HOLD_MS) * 100)));
        if (elapsed >= HOLD_MS) {
          windowStart.current = now;
          phaseRef.current = "flip_window";
          setLabel(tr("challenge.face.flip"));
        }
        return;
      }

      if (phase === "flip_window") {
        const start = windowStart.current ?? now;
        if (now - start > FLIP_WINDOW_MS) {
          holdStart.current = null;
          windowStart.current = null;
          phaseRef.current = "wait_down";
          setLabel(tr("challenge.face.wait"));
          setHoldPct(0);
          return;
        }
        if (isFaceUp(z)) {
          finished.current = true;
          phaseRef.current = "done";
          setHoldPct(100);
          queueMicrotask(() => onCompleteRef.current());
        }
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.face.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.face.body")}</Text>
      <Text style={styles.status}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${holdPct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", alignItems: "center", gap: 12 },
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
  },
  status: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.emberSoft,
    textAlign: "center",
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
});
