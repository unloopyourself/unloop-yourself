import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Translate } from "../i18n";
import { colors, typography } from "../theme";

type Props = {
  t: Translate;
  onComplete: () => void;
};

const NEED = 3;
/** Hold between taps so each count feels like one calm breath cycle. */
const LOCKOUT_MS = 3000;

export function BreathTapChallenge({ t, onComplete }: Props) {
  const [count, setCount] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(() => Date.now() + LOCKOUT_MS);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, lockedUntil - now);
  const locked = remainingMs > 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  const onTap = () => {
    if (locked) {
      return;
    }
    const next = count + 1;
    setCount(next);
    if (next >= NEED) {
      onComplete();
      return;
    }
    setLockedUntil(Date.now() + LOCKOUT_MS);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.breath.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.breath.body")}</Text>
      <Text style={styles.meta}>
        {count}/{NEED}
      </Text>
      <Pressable
        style={[styles.btn, locked && styles.btnLocked]}
        onPress={onTap}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel="Breathe tap"
        accessibilityState={{ disabled: locked }}
        testID="breath-tap"
      >
        <Text style={[styles.btnLabel, locked && styles.btnLabelLocked]}>
          {locked
            ? t("challenge.breath.wait", { sec: remainingSec })
            : t("challenge.breath.tap")}
        </Text>
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
    minWidth: 200,
    alignItems: "center",
  },
  btnLocked: {
    backgroundColor: colors.inkSoft,
    opacity: 0.85,
  },
  btnLabel: { color: colors.white, fontWeight: "700", fontSize: 16 },
  btnLabelLocked: { color: colors.textOnInk, opacity: 0.9 },
});
