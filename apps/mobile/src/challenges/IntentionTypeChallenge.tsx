import { useMemo, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { detectLocale, type Translate } from "../i18n";
import { challengeStyles as styles } from "./challengeUi";
import { normalizeUnlockPhrase } from "./UnlockPhraseChallenge";

type Props = {
  t: Translate;
  onComplete: () => void;
};

/** Short exit-oriented intentions — typing breaks scroll muscle memory. */
const INTENTIONS: Record<"en" | "it", readonly string[]> = {
  en: [
    "I choose to pause",
    "I am leaving the feed",
    "One check then done",
    "Back to the room",
    "I asked for this stop",
  ],
  it: [
    "Scelgo di fermarmi",
    "Lascio il feed",
    "Un controllo e basta",
    "Di nuovo nella stanza",
    "Ho chiesto questo stop",
  ],
};

export function IntentionTypeChallenge({ t, onComplete }: Props) {
  const locale = detectLocale() === "it" ? "it" : "en";
  const phrase = useMemo(() => {
    const pack = INTENTIONS[locale];
    return pack[Math.floor(Math.random() * pack.length)]!;
  }, [locale]);
  const [value, setValue] = useState("");
  const doneRef = useRef(false);
  const target = useMemo(() => normalizeUnlockPhrase(phrase), [phrase]);

  const onChange = (text: string) => {
    setValue(text);
    if (doneRef.current) {
      return;
    }
    if (normalizeUnlockPhrase(text) === target) {
      doneRef.current = true;
      onComplete();
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.intention.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.intention.body")}</Text>
      <Text style={styles.prompt} testID="intention-prompt">
        {phrase}
      </Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Intention phrase"
        testID="intention-input"
      />
    </View>
  );
}
