import { Linking, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors, typography } from "../theme";
import type { Translate } from "../i18n";
import { statusBarTopInset } from "../layout";

const APP_VERSION = "0.1.0";
const CONTACT_EMAIL = "unloopyourself.dev@gmail.com";
const REPO_URL = "https://github.com/unloopyourself/unloop-yourself";
const ISSUES_URL = `${REPO_URL}/issues`;

type Props = {
  t: Translate;
  onBack: () => void;
};

export function AboutScreen({ t, onBack }: Props) {
  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: statusBarTopInset(4) },
      ]}
    >      <Pressable
        onPress={onBack}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel={t("nav.back")}
      >
        <Text style={styles.backLabel}>← {t("nav.back")}</Text>
      </Pressable>

      <Text style={styles.brand}>Unloop</Text>
      <Text style={styles.title}>{t("about.title")}</Text>
      <Text style={styles.lead}>{t("about.lead")}</Text>
      <Text style={styles.body}>{t("about.privacy")}</Text>

      <Text style={styles.section}>{t("about.contact")}</Text>
      <Pressable
        onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
        accessibilityRole="link"
      >
        <Text style={styles.link}>{t("about.email")}</Text>
      </Pressable>

      <Text style={styles.section}>{t("about.source")}</Text>
      <Pressable
        onPress={() => void Linking.openURL(REPO_URL)}
        accessibilityRole="link"
      >
        <Text style={styles.link}>{t("about.repo")}</Text>
      </Pressable>
      <Pressable
        onPress={() => void Linking.openURL(ISSUES_URL)}
        accessibilityRole="link"
      >
        <Text style={styles.link}>{t("about.issues")}</Text>
      </Pressable>

      <Text style={styles.version}>
        {t("about.version", { version: APP_VERSION })}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 48,
    gap: 14,
  },
  back: { alignSelf: "flex-start", paddingVertical: 8 },
  backLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.teal,
  },
  brand: {
    fontSize: typography.brandSize,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -1.2,
    marginTop: 12,
  },
  title: {
    fontSize: typography.titleSize,
    fontWeight: "800",
    color: colors.ink,
  },
  lead: {
    fontSize: typography.bodySize,
    lineHeight: 24,
    color: colors.text,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  section: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  link: {
    fontSize: typography.bodySize,
    fontWeight: "700",
    color: colors.ember,
  },
  version: {
    marginTop: 24,
    fontSize: typography.metaSize,
    color: colors.textMuted,
  },
});
