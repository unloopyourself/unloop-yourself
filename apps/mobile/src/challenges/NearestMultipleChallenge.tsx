import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { detectLocale, type Translate } from "../i18n";
import { colors, typography } from "../theme";

type Props = {
  t: Translate;
  onComplete: () => void;
};

type Puzzle = { prompt: string; answer: number };

/**
 * Directional prompts only — never “nearest” alone when two answers tie
 * (e.g. odd → two nearest evens). Always say above/below (or higher/lower).
 */
const PUZZLES_EN: Puzzle[] = [
  { prompt: "Nearest multiple of 7 below 45?", answer: 42 },
  { prompt: "Nearest multiple of 5 above 23?", answer: 25 },
  { prompt: "Nearest multiple of 9 above 50?", answer: 54 },
  { prompt: "Nearest even number above 17?", answer: 18 },
  { prompt: "Nearest multiple of 3 above 20?", answer: 21 },
  { prompt: "Nearest multiple of 4 below 31?", answer: 28 },
  { prompt: "Nearest odd number below 20?", answer: 19 },
  { prompt: "Nearest multiple of 6 above 40?", answer: 42 },
];

const PUZZLES_IT: Puzzle[] = [
  { prompt: "Multiplo di 7 più vicino sotto 45?", answer: 42 },
  { prompt: "Multiplo di 5 più vicino sopra 23?", answer: 25 },
  { prompt: "Multiplo di 9 più vicino sopra 50?", answer: 54 },
  { prompt: "Numero pari più vicino sopra 17?", answer: 18 },
  { prompt: "Multiplo di 3 più vicino sopra 20?", answer: 21 },
  { prompt: "Multiplo di 4 più vicino sotto 31?", answer: 28 },
  { prompt: "Numero dispari più vicino sotto 20?", answer: 19 },
  { prompt: "Multiplo di 6 più vicino sopra 40?", answer: 42 },
];

export function NearestMultipleChallenge({ t, onComplete }: Props) {
  const puzzle = useMemo(() => {
    const pack =
      detectLocale() === "it" ? PUZZLES_IT : PUZZLES_EN;
    return pack[Math.floor(Math.random() * pack.length)]!;
  }, []);
  const [value, setValue] = useState("");
  const [hint, setHint] = useState("");

  const tryAnswer = (text: string) => {
    setValue(text);
    const n = Number(text.trim());
    if (Number.isFinite(n) && n === puzzle.answer) {
      onComplete();
      return;
    }
    if (text.trim().length > 0) {
      setHint("");
    }
  };

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
        onChangeText={tryAnswer}
        keyboardType="number-pad"
        accessibilityLabel="Math answer"
        testID="math-answer"
      />
      <Pressable
        style={styles.btn}
        onPress={submit}
        accessibilityRole="button"
        accessibilityLabel="Math unlock"
        testID="math-unlock"
      >
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
