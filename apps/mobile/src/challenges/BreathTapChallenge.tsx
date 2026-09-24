import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Translate } from "../i18n";
import { colors, typography } from "../theme";

type Props = {
  t: Translate;
  onComplete: () => void;
};

const NEED = 3;

export function BreathTapChallenge({ t, onComplete }: Props) {
  const [count, setCount] = useState(0);

  const onTap = () => {
    const next = count + 1;
    setCount(next);
    if (next >= NEED) {
      onComplete();
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.breath.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.breath.body")}</Text>
      <Text style={styles.meta}>
        {count}/{NEED}
      </Text>
      <Pressable style={styles.btn} onPress={onTap} accessibilityRole="button">
        <Text style={styles.btnLabel}>{t("challenge.breath.tap")}</Text>
      </Pressable>
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
  meta: { color: colors.emberSoft, fontWeight: "700", fontSize: 18 },
  btn: {
    marginTop: 8,
    backgroundColor: colors.ember,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnLabel: { color: colors.white, fontWeight: "700", fontSize: 16 },
});
