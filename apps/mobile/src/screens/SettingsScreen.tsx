import { useState } from "react";
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
import {
  SOFT_UNLOCK_MINUTE_OPTIONS,
  TIMING_MINUTE_OPTIONS,
  WATCH_TARGETS,
} from "../targets";
import { SETTINGS_CHALLENGE_CATALOG, type ChallengeId } from "../challenges/registry";
import type { UnloopSettings } from "../settings";
import { statusBarTopInset } from "../layout";
import {
  BUDDY_MAX_PUSH_OPTIONS,
  BUDDY_WARN_LEAD_MINUTE_OPTIONS,
} from "../buddySettings";

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
    minutes: number,
  ) => void;
  onPatchSettings: (patch: Partial<UnloopSettings>) => void;
  onOpenBuddy: () => void;
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
  onPatchSettings,
  onOpenBuddy,
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

      <Text style={styles.section}>{t("buddy.section")}</Text>
      <Pressable
        onPress={() =>
          onPatchSettings({ buddyEnabled: !settings.buddyEnabled })
        }
        style={[styles.buddyLink, settings.buddyEnabled && styles.buddyLinkOn]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: settings.buddyEnabled }}
      >
        <Text
          style={[
            styles.buddyLinkLabel,
            settings.buddyEnabled && styles.buddyLinkLabelOn,
          ]}
        >
          {settings.buddyEnabled ? "✓ " : ""}
          {t("buddy.enable")}
        </Text>
      </Pressable>
      <Pressable
        onPress={onOpenBuddy}
        style={styles.buddyLink}
        accessibilityRole="button"
      >
        <Text style={styles.buddyLinkLabel}>{t("buddy.open")}</Text>
      </Pressable>
      {settings.buddyEnabled ? (
        <>
          <TimingPicker
            label={t("buddy.warn_lead")}
            minutes={Math.round(settings.buddyWarnLeadMs / 60_000)}
            options={BUDDY_WARN_LEAD_MINUTE_OPTIONS}
            unitLabel={t("app.minutes_unit")}
            onSelect={(m) =>
              onPatchSettings({ buddyWarnLeadMs: m * 60_000 })
            }
          />
          <Pressable
            onPress={() =>
              onPatchSettings({
                buddyQuietHoursEnabled: !settings.buddyQuietHoursEnabled,
              })
            }
            style={[
              styles.buddyLink,
              settings.buddyQuietHoursEnabled && styles.buddyLinkOn,
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: settings.buddyQuietHoursEnabled }}
          >
            <Text
              style={[
                styles.buddyLinkLabel,
                settings.buddyQuietHoursEnabled && styles.buddyLinkLabelOn,
              ]}
            >
              {settings.buddyQuietHoursEnabled ? "✓ " : ""}
              {t("buddy.quiet_on")}
            </Text>
          </Pressable>
          {settings.buddyQuietHoursEnabled ? (
            <>
              <TimingPicker
                label={t("buddy.quiet_start")}
                minutes={settings.buddyQuietStartHour}
                options={[0, 6, 8, 20, 21, 22, 23]}
                unitLabel="h"
                onSelect={(h) => onPatchSettings({ buddyQuietStartHour: h })}
              />
              <TimingPicker
                label={t("buddy.quiet_end")}
                minutes={settings.buddyQuietEndHour}
                options={[6, 7, 8, 9, 10, 12]}
                unitLabel="h"
                onSelect={(h) => onPatchSettings({ buddyQuietEndHour: h })}
              />
            </>
          ) : null}
          <TimingPicker
            label={t("buddy.max_push")}
            minutes={settings.buddyMaxPushPerHour}
            options={BUDDY_MAX_PUSH_OPTIONS}
            unitLabel="/h"
            onSelect={(n) => onPatchSettings({ buddyMaxPushPerHour: n })}
          />
          <Pressable
            onPress={() =>
              onPatchSettings({
                buddyNotifyOnLeave: !settings.buddyNotifyOnLeave,
              })
            }
            style={[
              styles.buddyLink,
              settings.buddyNotifyOnLeave && styles.buddyLinkOn,
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: settings.buddyNotifyOnLeave }}
          >
            <Text
              style={[
                styles.buddyLinkLabel,
                settings.buddyNotifyOnLeave && styles.buddyLinkLabelOn,
              ]}
            >
              {settings.buddyNotifyOnLeave ? "✓ " : ""}
              {t("buddy.notify_leave")}
            </Text>
          </Pressable>
          <Text style={styles.timingLabel}>{t("buddy.default_nudge")}</Text>
          <TextInput
            style={styles.buddyInput}
            value={settings.buddyDefaultNudge}
            onChangeText={(text) =>
              onPatchSettings({ buddyDefaultNudge: text.slice(0, 280) })
            }
            placeholder={t("buddy.default_nudge_placeholder")}
            placeholderTextColor={colors.textMuted}
            multiline
          />
        </>
      ) : null}

      <Text style={styles.section}>{t("app.timings_section")}</Text>
      <TimingPicker
        label={t("app.threshold")}
        minutes={Math.round(settings.thresholdMs / 60_000)}
        options={TIMING_MINUTE_OPTIONS}
        unitLabel={t("app.minutes_unit")}
        onSelect={(m) => onSetTiming("thresholdMs", m)}
      />
      <TimingPicker
        label={t("app.cooldown")}
        minutes={Math.round(settings.cooldownMs / 60_000)}
        options={TIMING_MINUTE_OPTIONS}
        unitLabel={t("app.minutes_unit")}
        onSelect={(m) => onSetTiming("cooldownMs", m)}
      />
      <TimingPicker
        label={t("app.soft_timeout")}
        minutes={Math.round(settings.challengeTimeoutMs / 60_000)}
        options={SOFT_UNLOCK_MINUTE_OPTIONS}
        unitLabel={t("app.minutes_unit")}
        onSelect={(m) => onSetTiming("challengeTimeoutMs", m)}
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

function TimingPicker({
  label,
  minutes,
  options,
  unitLabel,
  onSelect,
}: {
  label: string;
  minutes: number;
  options: readonly number[];
  unitLabel: string;
  onSelect: (minutes: number) => void;
}) {
  return (
    <View style={styles.timingBlock}>
      <Text style={styles.timingLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((m) => {
          const on = m === minutes;
          return (
            <Pressable
              key={m}
              onPress={() => onSelect(m)}
              style={[styles.timingChip, on && styles.timingChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${m} ${unitLabel}`}
            >
              <Text style={[styles.timingChipLabel, on && styles.timingChipLabelOn]}>
                {m}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
  timingBlock: {
    width: "100%",
    gap: 8,
  },
  timingLabel: { color: colors.textMuted, fontSize: 13 },
  timingChip: {
    minWidth: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.chipOff,
    alignItems: "center",
  },
  timingChipOn: { backgroundColor: colors.chipOn },
  timingChipLabel: { fontWeight: "700", color: colors.ink, fontSize: 14 },
  timingChipLabelOn: { color: colors.white },
  meta: {
    marginTop: 8,
    fontSize: typography.metaSize,
    color: colors.textMuted,
  },
  buddyLink: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.chipOff,
  },
  buddyLinkOn: { backgroundColor: colors.chipOn },
  buddyLinkLabel: { fontWeight: "700", color: colors.ink, fontSize: 14 },
  buddyLinkLabelOn: { color: colors.white },
  buddyInput: {
    width: "100%",
    minHeight: 72,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 14,
    textAlignVertical: "top",
  },
});
