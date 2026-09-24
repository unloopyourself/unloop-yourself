import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../theme";
import type { Translate } from "../i18n";
import { statusBarTopInset } from "../layout";

type Props = {
  visible: boolean;
  t: Translate;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
};

export function MenuSheet({
  visible,
  t,
  onClose,
  onOpenSettings,
  onOpenAbout,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.backdrop, { paddingTop: statusBarTopInset(8) }]}
        onPress={onClose}
        accessibilityRole="button"
      >        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t("nav.menu")}</Text>
          <Pressable
            style={styles.row}
            onPress={() => {
              onClose();
              onOpenSettings();
            }}
            accessibilityRole="button"
          >
            <Text style={styles.rowLabel}>{t("nav.settings")}</Text>
          </Pressable>
          <Pressable
            style={styles.row}
            onPress={() => {
              onClose();
              onOpenAbout();
            }}
            accessibilityRole="button"
          >
            <Text style={styles.rowLabel}>{t("nav.about")}</Text>
          </Pressable>
          <Pressable style={styles.close} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeLabel}>{t("nav.close")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function MenuButton({
  onPress,
  accessibilityLabel,
}: {
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      style={styles.menuBtn}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.bar} />
      <View style={styles.bar} />
      <View style={styles.bar} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 37, 64, 0.45)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingHorizontal: 16,
  },
  sheet: {
    width: 260,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 4,
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: {
    fontSize: typography.metaSize,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
  },
  rowLabel: {
    fontSize: typography.bodySize,
    fontWeight: "700",
    color: colors.ink,
  },
  close: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  closeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  bar: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.ink,
  },
});
