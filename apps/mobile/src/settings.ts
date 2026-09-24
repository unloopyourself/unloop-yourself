import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CHALLENGE_TIMEOUT_MS,
  COOLDOWN_MS,
  DEFAULT_ENABLED_LABELS,
  THRESHOLD_MS,
} from "./targets";
import { DEFAULT_ENABLED_CHALLENGE_IDS } from "./challenges/registry";

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

function clampMs(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function loadSettings(): Promise<UnloopSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      // Migrate v1 labels if present.
      const v1 = await AsyncStorage.getItem("unloop.settings.v1");
      if (v1) {
        const parsed = JSON.parse(v1) as { enabledLabels?: string[] };
        return {
          ...DEFAULTS,
          enabledLabels:
            Array.isArray(parsed.enabledLabels) && parsed.enabledLabels.length > 0
              ? parsed.enabledLabels
              : DEFAULTS.enabledLabels,
        };
      }
      return { ...DEFAULTS, enabledLabels: [...DEFAULTS.enabledLabels], enabledChallengeIds: [...DEFAULTS.enabledChallengeIds] };
    }
    const parsed = JSON.parse(raw) as Partial<UnloopSettings>;
    const labels =
      Array.isArray(parsed.enabledLabels) && parsed.enabledLabels.length > 0
        ? parsed.enabledLabels
        : DEFAULTS.enabledLabels;
    const challenges =
      Array.isArray(parsed.enabledChallengeIds) && parsed.enabledChallengeIds.length > 0
        ? parsed.enabledChallengeIds
        : DEFAULTS.enabledChallengeIds;
    return {
      enabledLabels: labels,
      enabledChallengeIds: challenges,
      thresholdMs: clampMs(parsed.thresholdMs, DEFAULTS.thresholdMs, 15_000, 600_000),
      cooldownMs: clampMs(parsed.cooldownMs, DEFAULTS.cooldownMs, 30_000, 600_000),
      challengeTimeoutMs: clampMs(
        parsed.challengeTimeoutMs,
        DEFAULTS.challengeTimeoutMs,
        15_000,
        180_000,
      ),
    };
  } catch {
    return {
      ...DEFAULTS,
      enabledLabels: [...DEFAULTS.enabledLabels],
      enabledChallengeIds: [...DEFAULTS.enabledChallengeIds],
    };
  }
}

export async function saveSettings(settings: UnloopSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}
