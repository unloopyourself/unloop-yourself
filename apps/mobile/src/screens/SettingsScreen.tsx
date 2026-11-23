import { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Capability } from "@unloop/core";
import { colors, typography } from "../theme";
import type { Translate } from "../i18n";
import { WATCH_TARGETS } from "../targets";
import { SETTINGS_CHALLENGE_CATALOG, type ChallengeId } from "../challenges/registry";
import type { UnloopSettings } from "../settings";
import { statusBarTopInset } from "../layout";

type Props = {
  t: Translate;
  settings: UnloopSettings;
  deviceCaps: ReadonlySet<Capability>;
  permission: boolean | null;
  overlayPermission: boolean | null;
  onBack: () => void;
  onToggleLabel: (label: string) => void;
  onToggleChallenge: (id: ChallengeId) => void;
  onSetTiming: (
    key: "thresholdMs" | "cooldownMs" | "challengeTimeoutMs",
    secondsText: string,
  ) => void;
};

export function SettingsScreen({
  t,
  settings,
  deviceCaps,
  permission,
  overlayPermission,
  onBack,
  onToggleLabel,
  onToggleChallenge,
  onSetTiming,
}: Props) {
  const [expandedChallengeId, setExpandedChallengeId] =
    useState<ChallengeId | null>(null);

  const toggleExpand = (id: ChallengeId) => {
    setExpandedChallengeId((prev) => (prev === id ? null : id));
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: statusBarTopInset(4) },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={onBack}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel={t("nav.back")}
      >
        <Text style={styles.backLabel}>← {t("nav.back")}</Text>
      </Pressable>

      <Text style={styles.title}>{t("nav.settings")}</Text>

      <Text style={styles.section}>{t("app.feeds_section")}</Text>
      <View style={styles.chips}>
        {WATCH_TARGETS.map((app) => {
          const on = settings.enabledLabels.includes(app.label);
          return (
            <Pressable
              key={app.label}
              onPress={() => onToggleLabel(app.label)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>
                {app.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>{t("app.challenges_section")}</Text>
      <View style={styles.challengeList}>
        {SETTINGS_CHALLENGE_CATALOG.map((c) => {
          const on = settings.enabledChallengeIds.includes(c.id);
          const expanded = expandedChallengeId === c.id;
          const hardwareOk = [...c.requires].every((cap) =>
            deviceCaps.has(cap),
          );
          return (
            <View
              key={c.id}
              style={[
                styles.challengeRow,
                on && styles.challengeRowOn,
                !hardwareOk && styles.challengeRowUnavailable,
              ]}
            >
              <Pressable
                onPress={() => toggleExpand(c.id)}
                style={styles.challengeMain}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityHint={
                  hardwareOk ? undefined : "Not available on this device"
                }
              >
                <Text
                  style={[
                    styles.challengeTitle,
                    on && styles.challengeTitleOn,
                  ]}
                >
                  {t(c.titleKey)}
                </Text>
                {expanded ? (
                  <Text
                    style={[
                      styles.challengeBody,
                      on && styles.challengeBodyOn,
                    ]}
                  >
                    {t(c.bodyKey)}
                  </Text>
                ) : null}
              </Pressable>
              <Pressable
                onPress={() => onToggleChallenge(c.id)}
                style={[styles.enableHit, on && styles.enableHitOn]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: !hardwareOk }}
                accessibilityLabel={t(c.titleKey)}
              >
                <Text style={[styles.enableMark, on && styles.enableMarkOn]}>
                  {on ? "✓" : ""}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Text style={styles.section}>{t("app.timings_section")}</Text>
      <TimingRow
        label={t("app.threshold")}
        seconds={Math.round(settings.thresholdMs / 1000)}
        onCommit={(s) => onSetTiming("thresholdMs", s)}
      />
      <TimingRow
        label={t("app.cooldown")}
        seconds={Math.round(settings.cooldownMs / 1000)}
        onCommit={(s) => onSetTiming("cooldownMs", s)}
      />
      <TimingRow
        label={t("app.soft_timeout")}
        seconds={Math.round(settings.challengeTimeoutMs / 1000)}
        onCommit={(s) => onSetTiming("challengeTimeoutMs", s)}
      />

      {Platform.OS === "android" && (
        <Text style={styles.meta}>
          {t("app.usage")}:{" "}
          {permission == null
            ? "…"
            : permission
              ? t("app.ok")
              : t("app.needed")}
          {" · "}
          {t("app.overlay")}:{" "}
          {overlayPermission == null
            ? "…"
            : overlayPermission
              ? t("app.ok")
              : t("app.needed")}
        </Text>
      )}
    </ScrollView>
  );
}

function TimingRow({
  label,
  seconds,
  onCommit,
}: {
  label: string;
  seconds: number;
  onCommit: (text: string) => void;
}) {
  const [text, setText] = useState(String(seconds));
  useEffect(() => {
    setText(String(seconds));
  }, [seconds]);
  return (
    <View style={styles.timingRow}>
      <Text style={styles.timingLabel}>{label}</Text>
      <TextInput
        style={styles.timingInput}
        value={text}
        onChangeText={setText}
        onEndEditing={() => onCommit(text)}
        keyboardType="number-pad"
      />
    </View>
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
  title: {
    fontSize: typography.titleSize,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 4,
  },
  section: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    alignSelf: "flex-start",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.chipOff,
  },
  chipOn: { backgroundColor: colors.chipOn },
  chipLabel: { fontWeight: "700", color: colors.ink, fontSize: 14 },
  chipLabelOn: { color: colors.white },
  challengeList: {
    width: "100%",
    gap: 8,
  },
  challengeRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.chipOff,
  },
  challengeRowOn: { backgroundColor: colors.chipOn },
  challengeRowUnavailable: { opacity: 0.45 },
  challengeMain: {
    flex: 1,
    gap: 6,
    paddingVertical: 2,
  },
  challengeTitle: {
    fontWeight: "700",
    color: colors.ink,
    fontSize: 15,
  },
  challengeTitleOn: { color: colors.white },
  challengeBody: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  challengeBodyOn: { color: "rgba(242,245,248,0.85)" },
  enableHit: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    backgroundColor: colors.white,
  },
  enableHitOn: {
    backgroundColor: colors.ember,
    borderColor: colors.ember,
  },
  enableMark: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
  },
  enableMarkOn: { color: colors.white },
  timingRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  timingLabel: { flex: 1, color: colors.textMuted, fontSize: 13 },
  timingInput: {
    width: 72,
    borderWidth: 1,
    borderColor: colors.chipOff,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: "center",
    color: colors.ink,
    backgroundColor: colors.white,
    fontWeight: "700",
  },
  meta: {
    marginTop: 8,
    fontSize: typography.metaSize,
    color: colors.textMuted,
  },
});
