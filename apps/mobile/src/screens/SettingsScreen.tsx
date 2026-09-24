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
import { CHALLENGE_CATALOG, type ChallengeId } from "../challenges/registry";
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
      <View style={styles.chips}>
        {CHALLENGE_CATALOG.map((c) => {
          const on = settings.enabledChallengeIds.includes(c.id);
          const hardwareOk = [...c.requires].every((cap) =>
            deviceCaps.has(cap),
          );
          return (
            <Pressable
              key={c.id}
              onPress={() => onToggleChallenge(c.id)}
              style={[
                styles.chip,
                on && styles.chipOn,
                !hardwareOk && styles.chipUnavailable,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityHint={
                hardwareOk ? undefined : "Not available on this device"
              }
            >
              <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>
                {t(c.titleKey)}
              </Text>
            </Pressable>
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
  chipUnavailable: { opacity: 0.45 },
  chipLabel: { fontWeight: "700", color: colors.ink, fontSize: 14 },
  chipLabelOn: { color: colors.white },
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
