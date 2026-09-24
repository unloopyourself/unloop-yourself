import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  advanceAirWriteTracker,
  createAirWriteTracker,
  pickAirWriteWord,
  type AirWriteLocale,
} from "@unloop/core";
import type { Translate } from "../i18n";
import { detectLocale } from "../i18n";
import { subscribeAccelerometerRaw } from "../expoSensorPort";
import { colors, typography } from "../theme";

type Props = {
  t: Translate;
  onComplete: () => void;
};

export function AirWriteChallenge({ t, onComplete }: Props) {
  const locale = useMemo((): AirWriteLocale => {
    return detectLocale() === "it" ? "it" : "en";
  }, []);
  const targetWord = useMemo(() => pickAirWriteWord(locale), [locale]);
  const [strokeCount, setStrokeCount] = useState(0);
  const [hint, setHint] = useState(t("challenge.air.hint"));
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let state = createAirWriteTracker(targetWord);
    let finished = false;
    const { stop } = subscribeAccelerometerRaw((ax, ay, az, deltaMs) => {
      if (finished) {
        return;
      }
      state = advanceAirWriteTracker(state, { ax, ay, az, deltaMs });
      setStrokeCount(state.strokes.length);
      if (state.strokes.length > 0) {
        setHint(t("challenge.air.drawing"));
      }
      if (state.complete) {
        finished = true;
        stop();
        setHint(t("challenge.air.done"));
        queueMicrotask(() => onCompleteRef.current());
      }
    });
    return () => stop();
  }, [targetWord, t]);

  return (
    <View style={styles.wrap} accessibilityLabel="Air write challenge">
      <Text style={styles.title}>{t("challenge.air.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.air.body")}</Text>
      <Text style={styles.word}>{targetWord}</Text>
      <Text style={styles.meta}>{hint}</Text>
      <Text style={styles.meta}>
        {t("challenge.air.strokes", { n: strokeCount })}
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
  word: {
    marginTop: 8,
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: 8,
    color: colors.emberSoft,
  },
  meta: {
    fontSize: typography.metaSize,
    fontWeight: "600",
    color: colors.emberSoft,
    textAlign: "center",
  },
});
