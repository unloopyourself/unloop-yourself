import type { Challenge, DeviceContext } from "./challenge.js";
import { selectCompatibleChallenges } from "./challenge.js";

export type PolicyDecision =
  | { action: "ignore" }
  | { action: "interrupt"; reason: "threshold" }
  | { action: "cooldown_active" };

export interface PolicyInput {
  readonly inCooldown: boolean;
  readonly thresholdReached: boolean;
}

/** Minimal MVP policy: interrupt on threshold unless cooling down. */
export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  if (input.inCooldown) {
    return { action: "cooldown_active" };
  }
  if (input.thresholdReached) {
    return { action: "interrupt", reason: "threshold" };
  }
  return { action: "ignore" };
}

export interface ChallengeSelectionInput {
  readonly challenges: readonly Challenge[];
  readonly deviceContext: DeviceContext;
}

/** Pick first compatible challenge (MVP: no scoring yet). */
export function selectChallenge(input: ChallengeSelectionInput): Challenge | null {
  const compatible = selectCompatibleChallenges(input.challenges, input.deviceContext);
  return compatible[0] ?? null;
}
