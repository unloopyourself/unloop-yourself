/** Domain capability identifiers (platform-agnostic). */
export type Capability =
  | "accelerometer"
  | "gyroscope"
  | "pedometer"
  | "microphone"
  | "notifications"
  | "buddy"
  | "media";

/** Runtime availability for challenge selection. */
export interface DeviceContext {
  readonly availableCapabilities: ReadonlySet<Capability>;
}

/** Minimal Challenge contract (ADR-003). */
export interface Challenge {
  readonly id: string;
  readonly requires: ReadonlySet<Capability>;
}

/** True iff every required capability is available. */
export function isChallengeCompatible(
  challenge: Challenge,
  deviceContext: DeviceContext,
): boolean {
  for (const capability of challenge.requires) {
    if (!deviceContext.availableCapabilities.has(capability)) {
      return false;
    }
  }
  return true;
}

/** Filter challenges to those satisfying requires ⊆ availableCapabilities. */
export function selectCompatibleChallenges(
  challenges: readonly Challenge[],
  deviceContext: DeviceContext,
): Challenge[] {
  return challenges.filter((challenge) => isChallengeCompatible(challenge, deviceContext));
}
