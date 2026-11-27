/** Buddy progressive-path settings helpers (P3-07 / P3.5-09). */

import {
  DEFAULT_BUDDY_LOCKOUT_LEAD_MS,
  isInQuietHours,
} from "@unloop/core";

export { isInQuietHours };

/** Minimum 2 minutes before seeker interrupt (product rule). */
export const BUDDY_WARN_LEAD_MINUTE_OPTIONS = [2, 3, 5, 10] as const;
export const MIN_BUDDY_WARN_LEAD_MS = 2 * 60_000;
export const BUDDY_MAX_PUSH_OPTIONS = [1, 2, 3, 6, 12] as const;
/** Lockout lead seconds before U interrupt (P3.5-09). */
export const BUDDY_LOCKOUT_LEAD_SECOND_OPTIONS = [15, 30, 45, 60] as const;

export type BuddySettingsSlice = {
  /** Master gate for approaching / mailbox / push to buddies. Default off. */
  buddyEnabled: boolean;
  /** Minutes before interrupt to warn buddies. */
  buddyWarnLeadMs: number;
  buddyQuietHoursEnabled: boolean;
  /** Local hour 0–23 inclusive start. */
  buddyQuietStartHour: number;
  /** Local hour 0–23 exclusive end (wraps overnight). */
  buddyQuietEndHour: number;
  buddyDefaultNudge: string;
  buddyMaxPushPerHour: number;
  buddyNotifyOnLeave: boolean;
  /**
   * When on: quiet hours → silent staged PUT; active hours → staged PUT at
   * lockout if mailbox still empty. Default off.
   */
  buddyAutoSendStaged: boolean;
  /** Close live compose this many ms before estimated interrupt. */
  buddyLockoutLeadMs: number;
};

export const BUDDY_SETTINGS_DEFAULTS: BuddySettingsSlice = {
  buddyEnabled: false,
  buddyWarnLeadMs: 2 * 60_000,
  buddyQuietHoursEnabled: false,
  buddyQuietStartHour: 22,
  buddyQuietEndHour: 8,
  buddyDefaultNudge: "",
  buddyMaxPushPerHour: 3,
  buddyNotifyOnLeave: true,
  buddyAutoSendStaged: false,
  buddyLockoutLeadMs: DEFAULT_BUDDY_LOCKOUT_LEAD_MS,
};

export function clampHour(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(23, Math.max(0, Math.round(n)));
}

export function normalizeBuddySettings(
  parsed: Partial<BuddySettingsSlice>,
): BuddySettingsSlice {
  const warnMin = Math.round(
    (typeof parsed.buddyWarnLeadMs === "number"
      ? parsed.buddyWarnLeadMs
      : BUDDY_SETTINGS_DEFAULTS.buddyWarnLeadMs) / 60_000,
  );
  const snappedWarn =
    BUDDY_WARN_LEAD_MINUTE_OPTIONS.includes(
      warnMin as (typeof BUDDY_WARN_LEAD_MINUTE_OPTIONS)[number],
    )
      ? warnMin
      : 2;

  let maxPush =
    typeof parsed.buddyMaxPushPerHour === "number"
      ? parsed.buddyMaxPushPerHour
      : BUDDY_SETTINGS_DEFAULTS.buddyMaxPushPerHour;
  if (!BUDDY_MAX_PUSH_OPTIONS.includes(maxPush as (typeof BUDDY_MAX_PUSH_OPTIONS)[number])) {
    maxPush = 3;
  }

  const lockSec = Math.round(
    (typeof parsed.buddyLockoutLeadMs === "number"
      ? parsed.buddyLockoutLeadMs
      : BUDDY_SETTINGS_DEFAULTS.buddyLockoutLeadMs) / 1000,
  );
  const snappedLock =
    BUDDY_LOCKOUT_LEAD_SECOND_OPTIONS.includes(
      lockSec as (typeof BUDDY_LOCKOUT_LEAD_SECOND_OPTIONS)[number],
    )
      ? lockSec
      : 30;

  return {
    buddyEnabled: Boolean(parsed.buddyEnabled),
    buddyWarnLeadMs: snappedWarn * 60_000,
    buddyQuietHoursEnabled: Boolean(parsed.buddyQuietHoursEnabled),
    buddyQuietStartHour: clampHour(
      parsed.buddyQuietStartHour,
      BUDDY_SETTINGS_DEFAULTS.buddyQuietStartHour,
    ),
    buddyQuietEndHour: clampHour(
      parsed.buddyQuietEndHour,
      BUDDY_SETTINGS_DEFAULTS.buddyQuietEndHour,
    ),
    buddyDefaultNudge:
      typeof parsed.buddyDefaultNudge === "string"
        ? parsed.buddyDefaultNudge.slice(0, 280)
        : "",
    buddyMaxPushPerHour: maxPush,
    buddyNotifyOnLeave:
      parsed.buddyNotifyOnLeave === undefined
        ? BUDDY_SETTINGS_DEFAULTS.buddyNotifyOnLeave
        : Boolean(parsed.buddyNotifyOnLeave),
    buddyAutoSendStaged: Boolean(parsed.buddyAutoSendStaged),
    buddyLockoutLeadMs: snappedLock * 1000,
  };
}
