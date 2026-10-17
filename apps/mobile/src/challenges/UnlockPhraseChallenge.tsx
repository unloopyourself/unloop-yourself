import { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { detectLocale, type Translate } from "../i18n";
import { colors, typography } from "../theme";
import { pickUnlockPhrase } from "./unlockPhrases";

type Props = {
  t: Translate;
  onComplete: () => void;
};

/** Fold curly/smart quotes so phone keyboards match the prompt. */
export function normalizeUnlockPhrase(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201A\u2032\u00B4`]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function UnlockPhraseChallenge({ t, onComplete }: Props) {
  const phrase = useMemo(() => pickUnlockPhrase(detectLocale()), []);
  const [value, setValue] = useState("");
  const doneRef = useRef(false);
  const normalizedTarget = useMemo(
    () => normalizeUnlockPhrase(phrase),
    [phrase],
  );

  const onChange = (text: string) => {
    setValue(text);
    if (doneRef.current) {
      return;
    }
    if (normalizeUnlockPhrase(text) === normalizedTarget) {
      doneRef.current = true;
      onComplete();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={24}
    >
      <Text style={styles.title}>{t("challenge.phrase.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.phrase.body")}</Text>
      <Text
        style={styles.prompt}
        accessibilityLabel={phrase}
        testID="unlock-phrase-prompt"
      >
        {phrase}
      </Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        textContentType="none"
        spellCheck={false}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Unlock phrase"
        testID="unlock-phrase"
      />
    </KeyboardAvoidingView>
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
  prompt: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.emberSoft,
    textAlign: "center",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.emberSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.white,
    fontSize: 16,
    backgroundColor: colors.inkSoft,
  },
});
