import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Translate } from "../i18n";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
};

/**
 * Presence interrupt without native audio (expo-av ABI crash on device).
 * Visual "tone" bar fills, then goes quiet — tap in the quiet window.
 */
export function AudioSilenceTapChallenge({ t, onComplete }: Props) {
  const [phase, setPhase] = useState<"tone" | "silent" | "done">("tone");
  const [pct, setPct] = useState(0);
  const doneRef = useRef(false);
  const silentAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const toneMs = 900;
    const started = Date.now();
    const tick = setInterval(() => {
      if (cancelled) {
        return;
      }
      const elapsed = Date.now() - started;
      if (elapsed < toneMs) {
        setPct(Math.min(100, Math.round((elapsed / toneMs) * 100)));
        return;
      }
      clearInterval(tick);
      setPct(100);
      silentAtRef.current = Date.now();
      setPhase("silent");
      setPct(0);
    }, 40);
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, []);

  const onTap = () => {
    if (doneRef.current || phase !== "silent") {
      return;
    }
    if (Date.now() - silentAtRef.current < 120) {
      return;
    }
    doneRef.current = true;
    setPhase("done");
    onComplete();
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.silence_tap.title")}</Text>
      <Text style={styles.subtitle}>
        {phase === "tone"
          ? t("challenge.silence_tap.listen")
          : t("challenge.silence_tap.body")}
      </Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${phase === "tone" ? pct : 0}%` },
          ]}
        />
      </View>
      <Pressable
        style={[styles.btn, phase === "tone" && { opacity: 0.45 }]}
        onPress={onTap}
        accessibilityRole="button"
        accessibilityLabel="Silence tap"
        testID="silence-tap"
      >
        <Text style={styles.btnLabel}>{t("challenge.silence_tap.tap")}</Text>
      </Pressable>
    </View>
  );
}
