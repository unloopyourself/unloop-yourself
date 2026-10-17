import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Translate } from "../i18n";
import { playSound, SOUND_TONE_HOLD } from "./audioPlayback";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
};

export function AudioSilenceTapChallenge({ t, onComplete }: Props) {
  const [phase, setPhase] = useState<"tone" | "silent" | "done">("tone");
  const doneRef = useRef(false);
  const silentAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPhase("tone");
      await playSound(SOUND_TONE_HOLD, { volume: 0.7 });
      if (cancelled) {
        return;
      }
      silentAtRef.current = Date.now();
      setPhase("silent");
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const onTap = () => {
    if (doneRef.current || phase !== "silent") {
      return;
    }
    // Require a beat of silence so early taps during tone do not succeed.
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
