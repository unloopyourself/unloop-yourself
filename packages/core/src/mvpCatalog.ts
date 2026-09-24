import type { Capability, Challenge, DeviceContext } from "./challenge.js";
import { isChallengeCompatible, selectCompatibleChallenges } from "./challenge.js";

/**
 * Shipping interrupt challenges as Core facts (ids + requires only).
 * UI titles / React live in apps/mobile; keep requires in sync via this list.
 */
export const MVP_CHALLENGES: readonly Challenge[] = [
  { id: "shake", requires: new Set<Capability>(["accelerometer"]) },
  { id: "breath_tap", requires: new Set<Capability>() },
  { id: "unlock_phrase", requires: new Set<Capability>() },
  { id: "nearest_multiple", requires: new Set<Capability>() },
  { id: "face_down_flip", requires: new Set<Capability>(["accelerometer"]) },
];

/** Default enabled set mirrors product defaults (excludes face_down until opted in). */
export const MVP_DEFAULT_ENABLED_IDS: readonly string[] = [
  "shake",
  "breath_tap",
  "unlock_phrase",
  "nearest_multiple",
];

/**
 * Test/docs capability profiles — not runtime objects in the app.
 * Axis is hardware availability, not Android API level.
 *
 * - low_end: no motion sensors (cheap / locked-down / accel unavailable)
 * - no_gyro: accelerometer only (typical phone + current AVD; no gyro challenges yet)
 * - full: richest set Unloop currently consumes (accel); grow when new Caps ship
 */
export type CapabilityProfileId = "low_end" | "no_gyro" | "full";

export const CAPABILITY_PROFILES: Record<
  CapabilityProfileId,
  ReadonlySet<Capability>
> = {
  low_end: new Set<Capability>(),
  no_gyro: new Set<Capability>(["accelerometer"]),
  full: new Set<Capability>(["accelerometer"]),
};

export function deviceContextForProfile(
  profile: CapabilityProfileId,
): DeviceContext {
  return { availableCapabilities: CAPABILITY_PROFILES[profile] };
}

/** Eligible challenges: enabled ∩ requires ⊆ available. */
export function selectEligibleChallenges(
  challenges: readonly Challenge[],
  enabledIds: readonly string[],
  available: ReadonlySet<Capability>,
): Challenge[] {
  const enabled = new Set(enabledIds);
  const device: DeviceContext = { availableCapabilities: available };
  return selectCompatibleChallenges(
    challenges.filter((c) => enabled.has(c.id)),
    device,
  );
}

/**
 * Pick one eligible id. Prefer enabled∩compatible; if empty, any soft
 * (requires∅) challenge still enabled; then any soft in catalog; never an
 * incompatible challenge. Returns null only if catalog has no soft fallback.
 */
export function pickEligibleChallengeId(
  challenges: readonly Challenge[],
  enabledIds: readonly string[],
  available: ReadonlySet<Capability>,
): string | null {
  const eligible = selectEligibleChallenges(challenges, enabledIds, available);
  if (eligible.length > 0) {
    const idx = Math.floor(Math.random() * eligible.length);
    return eligible[idx]!.id;
  }
  const softEnabled = selectEligibleChallenges(
    challenges.filter((c) => c.requires.size === 0),
    enabledIds,
    available,
  );
  if (softEnabled.length > 0) {
    return softEnabled[0]!.id;
  }
  const anySoft = challenges.find(
    (c) =>
      c.requires.size === 0 &&
      isChallengeCompatible(c, { availableCapabilities: available }),
  );
  return anySoft?.id ?? null;
}

/** Matrix cell: challenge id → profile → eligible? */
export function compatibilityMatrix(
  challenges: readonly Challenge[] = MVP_CHALLENGES,
  profiles: readonly CapabilityProfileId[] = ["low_end", "no_gyro", "full"],
): Record<string, Record<CapabilityProfileId, boolean>> {
  const matrix: Record<string, Record<CapabilityProfileId, boolean>> = {};
  for (const challenge of challenges) {
    const row = {} as Record<CapabilityProfileId, boolean>;
    for (const profile of profiles) {
      row[profile] = isChallengeCompatible(
        challenge,
        deviceContextForProfile(profile),
      );
    }
    matrix[challenge.id] = row;
  }
  return matrix;
}
