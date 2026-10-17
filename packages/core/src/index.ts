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

export {
  SHAKE_CHALLENGE_ID,
  advanceShakeProgress,
  shakeChallenge,
} from "./shakeChallenge.js";
export type { ShakeProgress, ShakeProgressInput } from "./shakeChallenge.js";

export {
  COIN_SPIN_CHALLENGE_ID,
  advanceCoinSpinProgress,
} from "./coinSpinChallenge.js";
export type { CoinSpinProgress } from "./coinSpinChallenge.js";

export {
  HOLD_STILL_CHALLENGE_ID,
  advanceHoldStillProgress,
} from "./holdStillChallenge.js";
export type { HoldStillProgress } from "./holdStillChallenge.js";

export {
  AIR_CIRCLE,
  AIR_COVERAGE_THRESHOLD,
  AIR_LETTER_CORRIDORS,
  AIR_SETTLE_MS,
  AIR_TILT_GAIN,
  AIR_TILT_SMOOTH,
  AIR_WRITE_CHALLENGE_ID,
  AIR_WRITE_WORDS,
  advanceAirWriteTracker,
  circleProgress,
  createAirWriteTracker,
  currentCorridor,
  detectSmallCircle,
  findTrailingCircleStart,
  letterTemplate,
  makeCirclePath,
  normalizeGravity,
  normalizePath,
  pathExtentSide,
  pathWinding,
  pickAirWriteWord,
  pointInCorridor,
  sampleCorridorCenterline,
  scriptCompleteAirWriteWord,
  smoothGravity,
  strokeCoverage,
  tiltDeltaToPlane,
} from "./airWriteChallenge.js";
export type {
  AirCorridor,
  AirLetterTemplate,
  AirPoint,
  AirWriteLocale,
  AirWritePhase,
  AirWriteTrackerState,
} from "./airWriteChallenge.js";

export {
  MVP_CHALLENGES,
  MVP_DEFAULT_ENABLED_IDS,
  CAPABILITY_PROFILES,
  compatibilityMatrix,
  deviceContextForProfile,
  pickEligibleChallengeId,
  selectEligibleChallenges,
} from "./mvpCatalog.js";
export type { CapabilityProfileId, PickEligibleOptions } from "./mvpCatalog.js";

export {
  SessionEngine,
  challengeProgressDisplayPct,
} from "./sessionEngine.js";
export type {
  ChallengePicker,
  CooldownReason,
  EngineClock,
  EngineEffect,
  EngineSnapshot,
  EngineTimings,
} from "./sessionEngine.js";

/** Unloop core package entry — domain logic only (no React Native / Expo). */

export const CORE_PACKAGE_NAME = "@unloop/core" as const;

export function corePackageInfo(): { name: typeof CORE_PACKAGE_NAME; version: string } {
  return { name: CORE_PACKAGE_NAME, version: "0.0.0" };
}
