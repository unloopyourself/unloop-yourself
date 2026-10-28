import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Translate } from "../i18n";
import { challengeStyles as styles } from "./challengeUi";
import { playChallengeTone, stopChallengeTone } from "./challengeTone";

type Props = {
  t: Translate;
  onComplete: () => void;
};

const TONE_MS = 10_000;

/**
 * Presence interrupt: short native tone (Android ToneGenerator adapter) +
 * visual bar, then tap in the quiet window. No expo-av.
 */
export function AudioSilenceTapChallenge({ t, onComplete }: Props) {
  const [phase, setPhase] = useState<"tone" | "silent" | "done">("tone");
  const [pct, setPct] = useState(0);
  const [heardTone, setHeardTone] = useState(false);
  const doneRef = useRef(false);
  const silentAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    const played = playChallengeTone(TONE_MS);
    if (!cancelled) {
      setHeardTone(played);
    }
    const tick = setInterval(() => {
      if (cancelled) {
        return;
      }
      const elapsed = Date.now() - started;
      if (elapsed < TONE_MS) {
        setPct(Math.min(100, Math.round((elapsed / TONE_MS) * 100)));
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
      stopChallengeTone();
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
          ? heardTone
            ? t("challenge.silence_tap.listen")
            : t("challenge.silence_tap.listen_visual")
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
