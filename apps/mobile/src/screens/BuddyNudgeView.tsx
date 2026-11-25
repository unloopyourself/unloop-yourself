import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Translate } from "../i18n";
import { colors, typography } from "../theme";

type Props = {
  t: Translate;
  body: string;
  onContinue: () => void;
};

/** Interrupt surface for a buddy text nudge (before / instead of challenge UI). */
export function BuddyNudgeView({ t, body, onContinue }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>{t("buddy.nudge_from")}</Text>
      <Text style={styles.body}>{body}</Text>
      <Pressable
        style={styles.btn}
        onPress={onContinue}
        accessibilityRole="button"
      >
        <Text style={styles.btnLabel}>{t("buddy.nudge_continue")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    gap: 16,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(242,245,248,0.7)",
  },
  body: {
    fontSize: typography.bodySize + 2,
    lineHeight: 26,
    fontWeight: "600",
    color: colors.textOnInk,
    textAlign: "center",
  },
  btn: {
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.ember,
  },
  btnLabel: { fontWeight: "800", color: colors.white, fontSize: 15 },
});
