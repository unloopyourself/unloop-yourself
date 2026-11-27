import { requireNativeModule } from "expo";

export type ThresholdNativeEvent = {
  appId: string;
  deltaU: number;
  observedAtMs: number;
};

export type MonitorSnapshot = {
  monitoring: boolean;
  challengeOutstanding: boolean;
  /** True while the TYPE_APPLICATION_OVERLAY shield is attached. */
  overlayShowing?: boolean;
  inCooldown: boolean;
  cooldownUntilMs: number;
  packagesCsv: string;
  lastAppId: string;
  lastDeltaU: number;
  /** Live usage accumulator toward threshold (ms). */
  accumulatedMs?: number;
  /** Active native threshold (ms) — may differ from Settings if harness stuck. */
  thresholdMs?: number;
  /** True while a watched feed is foreground / playing. */
  inTargetFeed?: boolean;
  /** Native Buddy approaching bout (when monitoring). */
  eventId?: string;
  approachingSent?: boolean;
  enabled?: boolean;
};

export type BuddyApproachingState = {
  enabled: boolean;
  warnLeadMs: number;
  eventId: string;
  approachingSent: boolean;
  seekerMailboxId: string;
  notifyCount: number;
};

type UnloopUsageNativeModule = {
  hasUsagePermission(): boolean;
  openUsageAccessSettings(): void;
  hasOverlayPermission(): boolean;
  openOverlaySettings(): void;
  getUsageMsForPackage(packageName: string, startMs: number, endMs: number): number;
  bringAppToForeground(): void;
  /** Reorder Unloop activity to front (in-app challenge / Buddy — not overlay-only). */
  bringActivityToFront(): void;
  dismissInterruptOverlay(): void;
  /** Hide shield without clearing outstanding (Buddy nudge / in-app challenge). */
  hideInterruptOverlayForInApp(): void;
  setCooldownUntilMs(epochMs: number): void;
  clearCooldown(): void;
  /** Comma-separated Android package names. */
  startNativeMonitoring(packagesCsv: string, thresholdMs: number): void;
  /** Hot-swap watch list while monitoring (keeps cooldown). */
  updateMonitoredPackages(packagesCsv: string): void;
  /** Hot-update threshold while monitoring (clears stuck harness timings). */
  updateNativeThreshold(thresholdMs: number): void;
  stopNativeMonitoring(): void;
  getMonitorSnapshot(): MonitorSnapshot;
  /** Persist Buddy notify targets for the native FGS (JS timers pause in BG). */
  syncBuddyApproachingConfig(
    enabled: boolean,
    warnLeadMs: number,
    relayUrl: string,
    seekerMailboxId: string,
    notifyMailboxesCsv: string,
  ): void;
  getBuddyApproachingState(): BuddyApproachingState;
  /** Debug/AVD: forced challenge id from DebugHarnessReceiver, or "". */
  getHarnessForceChallengeId(): string;
  /** Debug/AVD: clear forceChallenge + capabilities override. */
  clearHarnessDebugState(): void;
  /**
   * Debug/AVD: null = probe sensors; "" = no capabilities; "accelerometer" = csv.
   */
  getHarnessCapabilitiesOverride(): string | null;
  /** Debug/AVD: structured log line for harness asserts. */
  logHarness(message: string): void;
  /** Thin Android tone (ToneGenerator). false if playback could not start. */
  playChallengeTone(durationMs: number): boolean;
  stopChallengeTone(): void;
  addListener(
    eventName: "onThresholdReached" | "onOpenChallenge" | "onSoftSkipChallenge",
    listener: (event: ThresholdNativeEvent | Record<string, never>) => void,
  ): { remove: () => void };
};

const UnloopUsage = requireNativeModule("UnloopUsage") as UnloopUsageNativeModule;

export function addThresholdListener(
  listener: (event: ThresholdNativeEvent) => void,
): { remove: () => void } {
  return UnloopUsage.addListener("onThresholdReached", listener as (event: ThresholdNativeEvent | Record<string, never>) => void);
}

export function addOpenChallengeListener(listener: () => void): { remove: () => void } {
  return UnloopUsage.addListener("onOpenChallenge", () => {
    listener();
  });
}

export function addSoftSkipChallengeListener(listener: () => void): { remove: () => void } {
  return UnloopUsage.addListener("onSoftSkipChallenge", () => {
    listener();
  });
}

export default UnloopUsage;
