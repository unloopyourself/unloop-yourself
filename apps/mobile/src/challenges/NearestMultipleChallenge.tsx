import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Translate } from "../i18n";
import { colors, typography } from "../theme";

type Props = {
  t: Translate;
  onComplete: () => void;
};

type Puzzle = { prompt: string; answer: number };

const PUZZLES: Puzzle[] = [
  { prompt: "Nearest multiple of 7 to 45?", answer: 42 },
  { prompt: "Nearest multiple of 5 to 23?", answer: 25 },
  { prompt: "Nearest multiple of 9 to 50?", answer: 54 },
  { prompt: "Nearest even number to 17?", answer: 18 },
  { prompt: "Nearest multiple of 3 to 20?", answer: 21 },
];

export function NearestMultipleChallenge({ t, onComplete }: Props) {
  const puzzle = useMemo(
    () => PUZZLES[Math.floor(Math.random() * PUZZLES.length)]!,
    [],
  );
  const [value, setValue] = useState("");
  const [hint, setHint] = useState("");

  const submit = () => {
    const n = Number(value.trim());
    if (n === puzzle.answer) {
      onComplete();
      return;
    }
    setHint("…");
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.math.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.math.body")}</Text>
      <Text style={styles.prompt}>{puzzle.prompt}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        keyboardType="number-pad"
        accessibilityLabel="Math answer"
      />
      <Pressable style={styles.btn} onPress={submit} accessibilityRole="button">
        <Text style={styles.btnLabel}>{t("challenge.math.submit")}</Text>
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
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
    fontSize: 18,
    textAlign: "center",
    backgroundColor: colors.inkSoft,
  },
  btn: {
    backgroundColor: colors.ember,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnLabel: { color: colors.white, fontWeight: "700", fontSize: 16 },
  hint: { color: colors.textOnInk, opacity: 0.6 },
});
