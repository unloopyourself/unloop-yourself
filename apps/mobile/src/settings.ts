import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CHALLENGE_TIMEOUT_MS,
  COOLDOWN_MS,
  DEFAULT_ENABLED_LABELS,
  LEGACY_CHALLENGE_TIMEOUT_MS,
  SOFT_UNLOCK_MINUTE_OPTIONS,
  THRESHOLD_MS,
  TIMING_MINUTE_OPTIONS,
} from "./targets";
import { DEFAULT_ENABLED_CHALLENGE_IDS, sanitizeEnabledChallengeIds } from "./challenges/registry";
import {
  BUDDY_SETTINGS_DEFAULTS,
  normalizeBuddySettings,
  type BuddySettingsSlice,
} from "./buddySettings";

const KEY = "unloop.settings.v2";
const MINUTE_MS = 60_000;

export type UnloopSettings = {
  enabledLabels: string[];
  enabledChallengeIds: string[];
  thresholdMs: number;
  cooldownMs: number;
  challengeTimeoutMs: number;
} & BuddySettingsSlice;

const DEFAULTS: UnloopSettings = {
  enabledLabels: [...DEFAULT_ENABLED_LABELS],
  enabledChallengeIds: [...DEFAULT_ENABLED_CHALLENGE_IDS],
  thresholdMs: THRESHOLD_MS,
  cooldownMs: COOLDOWN_MS,
  challengeTimeoutMs: CHALLENGE_TIMEOUT_MS,
  ...BUDDY_SETTINGS_DEFAULTS,
};

/**
 * Process-local write-through cache. Survives Activity / React remounts while
 * the JS runtime is alive, so a threshold that races AsyncStorage cannot revive
 * the previous challenge list after a Settings toggle.
 */
let memorySettings: UnloopSettings | null = null;

function clampMs(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Snap stored ms onto the nearest minute preset (settings UI is minute chips). */
export function snapMsToMinuteOptions(
  ms: number,
  options: readonly number[],
  fallbackMs: number,
): number {
  if (!Number.isFinite(ms) || options.length === 0) {
    return fallbackMs;
  }
  const minutes = ms / MINUTE_MS;
  let best = options[0]!;
  let bestDist = Math.abs(best - minutes);
  for (let i = 1; i < options.length; i += 1) {
    const opt = options[i]!;
    const dist = Math.abs(opt - minutes);
    if (dist < bestDist) {
      best = opt;
      bestDist = dist;
    }
  }
  return best * MINUTE_MS;
}

function resolveChallengeTimeoutMs(raw: unknown): number {
  const clamped = clampMs(raw, DEFAULTS.challengeTimeoutMs, MINUTE_MS, 600_000);
  // Upgrade devices still on the old 45s factory default (too short for air write).
  if (clamped === LEGACY_CHALLENGE_TIMEOUT_MS) {
    return DEFAULTS.challengeTimeoutMs;
  }
  return snapMsToMinuteOptions(
    clamped,
    SOFT_UNLOCK_MINUTE_OPTIONS,
    DEFAULTS.challengeTimeoutMs,
  );
}

function cloneSettings(s: UnloopSettings): UnloopSettings {
  return {
    ...s,
    enabledLabels: [...s.enabledLabels],
    enabledChallengeIds: [...s.enabledChallengeIds],
  };
}

function normalize(parsed: Partial<UnloopSettings>): UnloopSettings {
  const labels =
    Array.isArray(parsed.enabledLabels) && parsed.enabledLabels.length > 0
      ? parsed.enabledLabels
      : DEFAULTS.enabledLabels;
  const challenges = sanitizeEnabledChallengeIds(
    Array.isArray(parsed.enabledChallengeIds) && parsed.enabledChallengeIds.length > 0
      ? parsed.enabledChallengeIds
      : DEFAULTS.enabledChallengeIds,
  );
  return {
    enabledLabels: labels,
    enabledChallengeIds: challenges,
    thresholdMs: snapMsToMinuteOptions(
      clampMs(parsed.thresholdMs, DEFAULTS.thresholdMs, MINUTE_MS, 3_600_000),
      TIMING_MINUTE_OPTIONS,
      DEFAULTS.thresholdMs,
    ),
    cooldownMs: snapMsToMinuteOptions(
      clampMs(parsed.cooldownMs, DEFAULTS.cooldownMs, MINUTE_MS, 3_600_000),
      TIMING_MINUTE_OPTIONS,
      DEFAULTS.cooldownMs,
    ),
    challengeTimeoutMs: resolveChallengeTimeoutMs(parsed.challengeTimeoutMs),
    ...normalizeBuddySettings(parsed),
  };
}

export async function loadSettings(): Promise<UnloopSettings> {
  if (memorySettings) {
    return cloneSettings(memorySettings);
  }
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      // Migrate v1 labels if present.
      const v1 = await AsyncStorage.getItem("unloop.settings.v1");
      if (v1) {
        const parsed = JSON.parse(v1) as { enabledLabels?: string[] };
        const migrated = {
          ...DEFAULTS,
          enabledLabels:
            Array.isArray(parsed.enabledLabels) && parsed.enabledLabels.length > 0
              ? parsed.enabledLabels
              : DEFAULTS.enabledLabels,
        };
        memorySettings = migrated;
        return cloneSettings(migrated);
      }
      const fresh = cloneSettings(DEFAULTS);
      memorySettings = fresh;
      return cloneSettings(fresh);
    }
    // Prefer any toggle that landed while this read was in flight.
    if (memorySettings) {
      return cloneSettings(memorySettings);
    }
    const loaded = normalize(JSON.parse(raw) as Partial<UnloopSettings>);
    memorySettings = loaded;
    return cloneSettings(loaded);
  } catch {
    const fallback = cloneSettings(DEFAULTS);
    memorySettings = fallback;
    return fallback;
  }
}

export async function saveSettings(settings: UnloopSettings): Promise<void> {
  memorySettings = cloneSettings(settings);
  await AsyncStorage.setItem(KEY, JSON.stringify(memorySettings));
}

/** Test helper — drop the process-local cache. */
export function clearSettingsMemoryCache(): void {
  memorySettings = null;
}
