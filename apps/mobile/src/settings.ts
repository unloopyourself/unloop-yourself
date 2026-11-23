import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CHALLENGE_TIMEOUT_MS,
  COOLDOWN_MS,
  DEFAULT_ENABLED_LABELS,
  LEGACY_CHALLENGE_TIMEOUT_MS,
  THRESHOLD_MS,
} from "./targets";
import { DEFAULT_ENABLED_CHALLENGE_IDS, sanitizeEnabledChallengeIds } from "./challenges/registry";

const KEY = "unloop.settings.v2";

export type UnloopSettings = {
  enabledLabels: string[];
  enabledChallengeIds: string[];
  thresholdMs: number;
  cooldownMs: number;
  challengeTimeoutMs: number;
};

const DEFAULTS: UnloopSettings = {
  enabledLabels: [...DEFAULT_ENABLED_LABELS],
  enabledChallengeIds: [...DEFAULT_ENABLED_CHALLENGE_IDS],
  thresholdMs: THRESHOLD_MS,
  cooldownMs: COOLDOWN_MS,
  challengeTimeoutMs: CHALLENGE_TIMEOUT_MS,
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

function resolveChallengeTimeoutMs(raw: unknown): number {
  const clamped = clampMs(raw, DEFAULTS.challengeTimeoutMs, 15_000, 300_000);
  // Upgrade devices still on the old 45s factory default (too short for air write).
  if (clamped === LEGACY_CHALLENGE_TIMEOUT_MS) {
    return DEFAULTS.challengeTimeoutMs;
  }
  return clamped;
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
    thresholdMs: clampMs(parsed.thresholdMs, DEFAULTS.thresholdMs, 15_000, 600_000),
    cooldownMs: clampMs(parsed.cooldownMs, DEFAULTS.cooldownMs, 30_000, 600_000),
    challengeTimeoutMs: resolveChallengeTimeoutMs(parsed.challengeTimeoutMs),
  };
}

export async function loadSettings(): Promise<UnloopSettings> {
  if (memorySettings) {
    return {
      ...memorySettings,
      enabledLabels: [...memorySettings.enabledLabels],
      enabledChallengeIds: [...memorySettings.enabledChallengeIds],
    };
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
        return {
          ...migrated,
          enabledLabels: [...migrated.enabledLabels],
          enabledChallengeIds: [...migrated.enabledChallengeIds],
        };
      }
      const fresh = {
        ...DEFAULTS,
        enabledLabels: [...DEFAULTS.enabledLabels],
        enabledChallengeIds: [...DEFAULTS.enabledChallengeIds],
      };
      memorySettings = fresh;
      return {
        ...fresh,
        enabledLabels: [...fresh.enabledLabels],
        enabledChallengeIds: [...fresh.enabledChallengeIds],
      };
    }
    // Prefer any toggle that landed while this read was in flight.
    if (memorySettings) {
      return {
        ...memorySettings,
        enabledLabels: [...memorySettings.enabledLabels],
        enabledChallengeIds: [...memorySettings.enabledChallengeIds],
      };
    }
    const loaded = normalize(JSON.parse(raw) as Partial<UnloopSettings>);
    memorySettings = loaded;
    return {
      ...loaded,
      enabledLabels: [...loaded.enabledLabels],
      enabledChallengeIds: [...loaded.enabledChallengeIds],
    };
  } catch {
    const fallback = {
      ...DEFAULTS,
      enabledLabels: [...DEFAULTS.enabledLabels],
      enabledChallengeIds: [...DEFAULTS.enabledChallengeIds],
    };
    memorySettings = fallback;
    return fallback;
  }
}

export async function saveSettings(settings: UnloopSettings): Promise<void> {
  memorySettings = {
    ...settings,
    enabledLabels: [...settings.enabledLabels],
    enabledChallengeIds: [...settings.enabledChallengeIds],
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(memorySettings));
}

/** Test helper — drop the process-local cache. */
export function clearSettingsMemoryCache(): void {
  memorySettings = null;
}
