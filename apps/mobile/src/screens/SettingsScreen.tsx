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
  BUDDY_LOCKOUT_LEAD_SECOND_OPTIONS,
  BUDDY_MAX_PUSH_OPTIONS,
  BUDDY_WARN_LEAD_MINUTE_OPTIONS,
} from "../buddySettings";
import {
  CollapsibleSection,
  MIN_TOUCH,
  NavRow,
  SECTION_DIVIDER,
  Section,
  ToggleRow,
} from "./SectionKit";

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
  // Session-only disclosure state. Secondary groups start collapsed.
  const [challengesOpen, setChallengesOpen] = useState(false);
  const [buddyOptionsOpen, setBuddyOptionsOpen] = useState(false);

  const toggleExpand = (id: ChallengeId) => {
    setExpandedChallengeId((prev) => (prev === id ? null : id));
  };

  const enabledChallengeCount = SETTINGS_CHALLENGE_CATALOG.filter((c) =>
    settings.enabledChallengeIds.includes(c.id),
  ).length;

  const hint = (open: boolean) =>
    t(open ? "section.collapse_hint" : "section.expand_hint");

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

      {/* Feeds: primary choice, always visible. */}
      <Section title={t("app.feeds_section")}>
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
      </Section>

      {/* Timing: three short pickers, always visible. */}
      <Section title={t("app.timings_section")}>
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
      </Section>

      {/* Challenges: long list, collapsed with a count summary. */}
      <CollapsibleSection
        title={t("app.challenges_section")}
        summary={t("app.challenges_summary", {
          on: enabledChallengeCount,
          total: SETTINGS_CHALLENGE_CATALOG.length,
        })}
        hint={hint(challengesOpen)}
        expanded={challengesOpen}
        onToggle={() => setChallengesOpen((v) => !v)}
      >
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
                  !hardwareOk && styles.challengeRowUnavailable,
                ]}
              >
                <Pressable
                  onPress={() => toggleExpand(c.id)}
                  style={styles.challengeMain}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityHint={
                    hardwareOk ? undefined : t("app.challenge_unavailable")
                  }
                >
                  <Text style={styles.challengeTitle}>{t(c.titleKey)}</Text>
                  {!hardwareOk ? (
                    <Text style={styles.challengeBody}>
                      {t("app.challenge_unavailable")}
                    </Text>
                  ) : null}
                  {expanded ? (
                    <Text style={styles.challengeBody}>{t(c.bodyKey)}</Text>
                  ) : null}
                </Pressable>
                <Pressable
                  onPress={() => onToggleChallenge(c.id)}
                  style={styles.enableTouch}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: !hardwareOk }}
                  accessibilityLabel={t(c.titleKey)}
                >
                  <View style={[styles.enableHit, on && styles.enableHitOn]}>
                    <Text style={[styles.enableMark, on && styles.enableMarkOn]}>
                      {on ? "✓" : ""}
                    </Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      </CollapsibleSection>

      {/* Buddy: Enable + Open stay visible; the rest lives behind "Buddy options". */}
      <Section title={t("buddy.section")}>
        <View>
          <ToggleRow
            label={t("buddy.enable")}
            value={settings.buddyEnabled}
            onValueChange={(next) => onPatchSettings({ buddyEnabled: next })}
          />
          <NavRow label={t("buddy.open")} onPress={onOpenBuddy} />
        </View>

        {settings.buddyEnabled ? (
          <CollapsibleSection
            variant="inline"
            title={t("buddy.options_title")}
            summary={t("buddy.options_summary", {
              lead: Math.round(settings.buddyWarnLeadMs / 60_000),
              max: settings.buddyMaxPushPerHour,
            })}
            hint={hint(buddyOptionsOpen)}
            expanded={buddyOptionsOpen}
            onToggle={() => setBuddyOptionsOpen((v) => !v)}
          >
            <TimingPicker
              label={t("buddy.warn_lead")}
              minutes={Math.round(settings.buddyWarnLeadMs / 60_000)}
              options={BUDDY_WARN_LEAD_MINUTE_OPTIONS}
              unitLabel={t("app.minutes_unit")}
              onSelect={(m) =>
                onPatchSettings({ buddyWarnLeadMs: m * 60_000 })
              }
            />

            <View>
              <ToggleRow
                label={t("buddy.quiet_on")}
                description={t("buddy.quiet")}
                value={settings.buddyQuietHoursEnabled}
                onValueChange={(next) =>
                  onPatchSettings({ buddyQuietHoursEnabled: next })
                }
              />
              {settings.buddyQuietHoursEnabled ? (
                <View style={styles.nested}>
                  <TimingPicker
                    label={t("buddy.quiet_start")}
                    minutes={settings.buddyQuietStartHour}
                    options={[0, 6, 8, 20, 21, 22, 23]}
                    unitLabel="h"
                    unitSuffix="h"
                    onSelect={(h) =>
                      onPatchSettings({ buddyQuietStartHour: h })
                    }
                  />
                  <TimingPicker
                    label={t("buddy.quiet_end")}
                    minutes={settings.buddyQuietEndHour}
                    options={[6, 7, 8, 9, 10, 12]}
                    unitLabel="h"
                    unitSuffix="h"
                    onSelect={(h) => onPatchSettings({ buddyQuietEndHour: h })}
                  />
                </View>
              ) : null}
            </View>

            <TimingPicker
              label={t("buddy.max_push")}
              minutes={settings.buddyMaxPushPerHour}
              options={BUDDY_MAX_PUSH_OPTIONS}
              unitLabel="/h"
              unitSuffix="/h"
              onSelect={(n) => onPatchSettings({ buddyMaxPushPerHour: n })}
            />

            <ToggleRow
              label={t("buddy.notify_leave")}
              value={settings.buddyNotifyOnLeave}
              onValueChange={(next) =>
                onPatchSettings({ buddyNotifyOnLeave: next })
              }
            />

            <ToggleRow
              label={t("buddy.auto_send_staged")}
              description={t("buddy.auto_send_staged_lead")}
              value={settings.buddyAutoSendStaged}
              onValueChange={(next) =>
                onPatchSettings({ buddyAutoSendStaged: next })
              }
            />
            <TimingPicker
              label={t("buddy.lockout_lead")}
              minutes={Math.round(settings.buddyLockoutLeadMs / 1000)}
              options={BUDDY_LOCKOUT_LEAD_SECOND_OPTIONS}
              unitLabel={t("buddy.seconds_unit")}
              unitSuffix={t("buddy.seconds_unit")}
              onSelect={(sec) =>
                onPatchSettings({ buddyLockoutLeadMs: sec * 1000 })
              }
            />

            <View style={styles.field}>
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
            </View>
          </CollapsibleSection>
        ) : null}
      </Section>

      {Platform.OS === "android" && (
        <Section title={t("app.permissions_section")}>
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
        </Section>
      )}
    </ScrollView>
  );
}

function TimingPicker({
  label,
  minutes,
  options,
  unitLabel,
  unitSuffix,
  onSelect,
}: {
  label: string;
  minutes: number;
  options: readonly number[];
  /** Spoken unit for accessibility labels. */
  unitLabel: string;
  /** Optional compact suffix shown after the current value in the label row. */
  unitSuffix?: string;
  onSelect: (minutes: number) => void;
}) {
  return (
    <View style={styles.timingBlock}>
      <View style={styles.timingHeader}>
        <Text style={styles.timingLabel}>{label}</Text>
        <Text style={styles.timingValue}>
          {minutes}
          {unitSuffix ?? ` ${unitLabel}`}
        </Text>
      </View>
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
    gap: 10,
  },
  back: {
    alignSelf: "flex-start",
    minHeight: MIN_TOUCH,
    justifyContent: "center",
  },
  backLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.teal,
  },
  title: {
    fontSize: typography.titleSize,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 6,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.chipOff,
  },
  chipOn: { backgroundColor: colors.chipOn },
  chipLabel: { fontWeight: "700", color: colors.ink, fontSize: 14 },
  chipLabelOn: { color: colors.white },
  challengeList: {
    width: "100%",
  },
  challengeRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SECTION_DIVIDER,
  },
  challengeRowUnavailable: { opacity: 0.5 },
  challengeMain: {
    flex: 1,
    minHeight: MIN_TOUCH,
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
  },
  challengeTitle: {
    fontWeight: "700",
    color: colors.ink,
    fontSize: 15,
  },
  challengeBody: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  /** 48dp touch area around the 32dp visual checkbox. */
  enableTouch: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: "center",
    justifyContent: "center",
  },
  enableHit: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
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
  timingHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  timingLabel: { flex: 1, color: colors.textMuted, fontSize: 13 },
  timingValue: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  timingChip: {
    minWidth: 48,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.chipOff,
    alignItems: "center",
  },
  timingChipOn: { backgroundColor: colors.chipOn },
  timingChipLabel: { fontWeight: "700", color: colors.ink, fontSize: 14 },
  timingChipLabelOn: { color: colors.white },
  meta: {
    fontSize: typography.metaSize,
    color: colors.textMuted,
  },
  nested: {
    gap: 14,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.chipOff,
    marginBottom: 4,
  },
  field: { width: "100%", gap: 8 },
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
