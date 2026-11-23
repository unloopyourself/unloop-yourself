import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  // Continuous inhale / exhale — visual stand-in for the old countdown copy.
  useEffect(() => {
    const half = LOCKOUT_MS / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: half,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: half,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      breath.stopAnimation();
    };
  }, [breath]);

  const remainingMs = Math.max(0, lockedUntil - now);
  const locked = remainingMs > 0;

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

  const scale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1.12],
  });
  const glow = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.breath.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.breath.body")}</Text>
      <Text style={styles.meta}>
        {count}/{NEED}
      </Text>

      <Animated.View
        style={[styles.lungsWrap, { opacity: glow, transform: [{ scale }] }]}
        accessibilityLabel={
          locked ? t("challenge.breath.wait", { sec: Math.ceil(remainingMs / 1000) }) : t("challenge.breath.tap")
        }
      >
        <View style={[styles.lung, styles.lungLeft]} />
        <View style={[styles.lung, styles.lungRight]} />
      </Animated.View>

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
          {locked ? "…" : t("challenge.breath.tap")}
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
  lungsWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 120,
    marginVertical: 8,
  },
  lung: {
    width: 56,
    height: 88,
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.emberSoft,
  },
  lungLeft: {
    borderTopLeftRadius: 48,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 20,
    transform: [{ rotate: "-6deg" }],
  },
  lungRight: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 48,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 40,
    transform: [{ rotate: "6deg" }],
  },
  btn: {
    marginTop: 4,
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
