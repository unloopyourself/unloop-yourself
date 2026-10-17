import { useMemo, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import type { Translate } from "../i18n";
import { challengeStyles as styles } from "./challengeUi";
import { normalizeUnlockPhrase } from "./UnlockPhraseChallenge";

type Props = {
  t: Translate;
  onComplete: () => void;
};

const TARGETS = ["3 2 1", "5 4 3 2 1", "2 1"] as const;

export function CountdownTypeChallenge({ t, onComplete }: Props) {
  const target = useMemo(
    () => TARGETS[Math.floor(Math.random() * TARGETS.length)]!,
    [],
  );
  const [value, setValue] = useState("");
  const doneRef = useRef(false);
  const normalized = useMemo(
    () => normalizeUnlockPhrase(target.replace(/\s+/g, "")),
    [target],
  );

  const onChange = (text: string) => {
    setValue(text);
    if (doneRef.current) {
      return;
    }
    const typed = normalizeUnlockPhrase(text.replace(/\s+/g, ""));
    if (typed === normalized) {
      doneRef.current = true;
      onComplete();
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.countdown.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.countdown.body")}</Text>
      <Text style={styles.prompt} testID="countdown-prompt">
        {target}
      </Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        autoCorrect={false}
        accessibilityLabel="Countdown type"
        testID="countdown-input"
      />
    </View>
  );
}
