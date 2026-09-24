import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, typography } from "../theme";
import type { Translate } from "../i18n";
import { MenuButton } from "./MenuSheet";
import { statusBarTopInset } from "../layout";

/** Tight crop for in-app hero (launcher icon keeps adaptive padding). */
const brandMark = require("../../assets/brand/unloop-mark-home.png");

type Props = {
  t: Translate;
  sessionState: string;
  lastDelta: number | null;
  message: string;
  monitoring: boolean;
  permissionLabel: string | null;
  onToggleMonitoring: () => void;
  onOpenMenu: () => void;
};

function statusKey(sessionState: string): string {
  if (sessionState === "MONITORING") {
    return "home.status_monitoring";
  }
  if (sessionState === "COOLDOWN") {
    return "home.status_cooldown";
  }
  return "home.status_paused";
}

export function HomeScreen({
  t,
  sessionState,
  lastDelta,
  message,
  monitoring,
  permissionLabel,
  onToggleMonitoring,
  onOpenMenu,
}: Props) {
  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: statusBarTopInset(4) },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBar}>
        <View style={styles.topSpacer} />
        <MenuButton onPress={onOpenMenu} accessibilityLabel={t("nav.menu")} />
      </View>

      <View style={styles.hero}>
        <View style={styles.markFrame}>
          <Image
            source={brandMark}
            style={styles.mark}
            accessibilityLabel="Unloop"
          />
        </View>
        <Text style={styles.brand}>Unloop</Text>
        <Text style={styles.tagline}>{t("app.tagline")}</Text>
        <View style={styles.statusPill}>
          <View
            style={[
              styles.statusDot,
              monitoring ? styles.statusDotOn : styles.statusDotOff,
            ]}
          />
          <Text style={styles.statusText}>{t(statusKey(sessionState))}</Text>
        </View>
        {lastDelta != null && (
          <Text style={styles.meta}>
            last bout {Math.round(lastDelta / 1000)}s
          </Text>
        )}
      </View>

      <Text style={styles.copy}>{message}</Text>
      <Text style={styles.hint}>{t("home.open_settings_hint")}</Text>

      {permissionLabel != null && (
        <Text style={styles.meta}>{permissionLabel}</Text>
      )}

      <Pressable
        style={[styles.button, styles.primary]}
        onPress={onToggleMonitoring}
        accessibilityRole="button"
      >
        <Text style={styles.buttonLabel}>
          {monitoring ? t("app.stop") : t("app.start")}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 48,
    gap: 16,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 8,
  },
  topSpacer: { flex: 1 },
  hero: {
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  markFrame: {
    width: 120,
    height: 120,
    borderRadius: 30,
    overflow: "hidden",
    marginBottom: 4,
    backgroundColor: colors.ink,
  },
  mark: {
    width: 120,
    height: 120,
  },
  brand: {
    fontSize: typography.brandSize,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -1.2,
  },
  tagline: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.teal,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOn: { backgroundColor: colors.ember },
  statusDotOff: { backgroundColor: colors.textMuted },
  statusText: {
    fontSize: typography.metaSize,
    fontWeight: "700",
    color: colors.ink,
  },
  meta: {
    fontSize: typography.metaSize,
    color: colors.textMuted,
    textAlign: "center",
  },
  copy: {
    fontSize: typography.bodySize,
    lineHeight: 24,
    textAlign: "center",
    color: colors.text,
    maxWidth: 340,
    alignSelf: "center",
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    color: colors.textMuted,
    maxWidth: 300,
    alignSelf: "center",
  },
  button: {
    marginTop: 12,
    alignSelf: "center",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    minWidth: 240,
    alignItems: "center",
  },
  primary: { backgroundColor: colors.ember },
  buttonLabel: { color: colors.white, fontSize: 16, fontWeight: "700" },
});
