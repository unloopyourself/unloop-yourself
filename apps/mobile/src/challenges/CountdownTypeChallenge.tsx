import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  COUNTDOWN_WINDOW_MS,
  formatCountdownValue,
  initialCountdownPrompt,
  promptAfterCorrect,
  promptAfterMiss,
  type CountdownPrompt,
} from "@unloop/core";
import type { Translate } from "../i18n";
import { colors } from "../theme";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
};

/**
 * Match the shown number among chips. Correct → next unit (entered high).
 * Wrong tap or ~5s idle → lower value in the same unit; after a wrong tap the
 * correct chip is never on the button just pressed.
 */
export function CountdownTypeChallenge({ t, onComplete }: Props) {
  const [prompt, setPrompt] = useState<CountdownPrompt>(() =>
    initialCountdownPrompt(),
  );
  const [flash, setFlash] = useState<"ok" | "miss" | null>(null);
  const doneRef = useRef(false);
  const promptRef = useRef(prompt);
  const onCompleteRef = useRef(onComplete);
  promptRef.current = prompt;
  onCompleteRef.current = onComplete;

  const applyMiss = (avoidCorrectAtIndex?: number) => {
    if (doneRef.current) {
      return;
    }
    setFlash("miss");
    const next = promptAfterMiss(
      promptRef.current,
      Math.random,
      avoidCorrectAtIndex === undefined
        ? undefined
        : { avoidCorrectAtIndex },
    );
    promptRef.current = next;
    setPrompt(next);
  };

  useEffect(() => {
    const id = setInterval(() => {
      applyMiss();
    }, COUNTDOWN_WINDOW_MS);
    return () => clearInterval(id);
  }, [prompt.display, prompt.value]);

  const onPick = (n: number, index: number) => {
    if (doneRef.current) {
      return;
    }
    if (Math.abs(n - promptRef.current.value) > 0.001) {
      applyMiss(index);
      return;
    }
    setFlash("ok");
    const stepped = promptAfterCorrect(promptRef.current);
    if (stepped === "done") {
      doneRef.current = true;
      onCompleteRef.current();
      return;
    }
    promptRef.current = stepped;
    setPrompt(stepped);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.countdown.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.countdown.body")}</Text>
      <Text style={[styles.prompt, { fontSize: 42 }]} testID="countdown-prompt">
        {prompt.display}
      </Text>
      <Text style={styles.meta}>
        {flash === "ok"
          ? t("challenge.countdown.ok")
          : flash === "miss"
            ? t("challenge.countdown.miss")
            : t("challenge.countdown.hint")}
      </Text>
      <View style={[styles.row, { width: "100%" }]}>
        {prompt.choices.map((n, index) => (
          <Pressable
            key={`${prompt.value}-${index}-${n}`}
            style={[
              styles.btnGhost,
              {
                flexGrow: 1,
                minWidth: "28%",
                backgroundColor: colors.inkSoft,
              },
            ]}
            onPress={() => onPick(n, index)}
            accessibilityRole="button"
            accessibilityLabel={`countdown-${formatCountdownValue(n)}`}
            testID={`countdown-choice-${index}`}
          >
            <Text style={styles.btnGhostLabel}>{formatCountdownValue(n)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
