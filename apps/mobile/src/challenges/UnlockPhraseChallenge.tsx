import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { Translate } from "../i18n";
import { colors, typography } from "../theme";

type Props = {
  t: Translate;
  onComplete: () => void;
};

export function UnlockPhraseChallenge({ t, onComplete }: Props) {
  const phrase = t("challenge.phrase.prompt");
  const [value, setValue] = useState("");
  const normalizedTarget = useMemo(
    () => phrase.trim().toLowerCase().replace(/\s+/g, " "),
    [phrase],
  );

  const onChange = (text: string) => {
    setValue(text);
    const got = text.trim().toLowerCase().replace(/\s+/g, " ");
    if (got === normalizedTarget) {
      onComplete();
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.phrase.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.phrase.body")}</Text>
      <Text style={styles.prompt}>{phrase}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Unlock phrase"
      />
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
