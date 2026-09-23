export type {
  Capability,
  Challenge,
  DeviceContext,
} from "./challenge.js";
export {
  isChallengeCompatible,
  selectCompatibleChallenges,
} from "./challenge.js";

export { TypedEventEmitter } from "./events.js";

export type { SessionEvent, SessionState } from "./session.js";
export {
  IllegalSessionTransitionError,
  SessionFsm,
  transition,
} from "./session.js";

export type {
  NotificationPort,
  SensorPort,
  SensorReading,
  StoragePort,
  ThresholdConfig,
  UsageDetectorPort,
  UsageSnapshot,
  UsageThresholdEvent,
} from "./ports.js";
export { InMemoryStoragePort, computeDeltaU } from "./ports.js";

export {
  baselineKey,
  clearBaseline,
  loadBaseline,
  observeUsageDelta,
  saveBaseline,
} from "./persistence.js";

export type { ChallengeSelectionInput, PolicyDecision, PolicyInput } from "./policy.js";
export { evaluatePolicy, selectChallenge } from "./policy.js";

/** Unloop core package entry — domain logic only (no React Native / Expo). */

export const CORE_PACKAGE_NAME = "@unloop/core" as const;

export function corePackageInfo(): { name: typeof CORE_PACKAGE_NAME; version: string } {
  return { name: CORE_PACKAGE_NAME, version: "0.0.0" };
}
