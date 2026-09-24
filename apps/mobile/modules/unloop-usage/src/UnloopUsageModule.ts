import { requireNativeModule } from "expo";

export type ThresholdNativeEvent = {
  appId: string;
  deltaU: number;
  observedAtMs: number;
};

export type MonitorSnapshot = {
  monitoring: boolean;
  challengeOutstanding: boolean;
  inCooldown: boolean;
  cooldownUntilMs: number;
  packagesCsv: string;
  lastAppId: string;
  lastDeltaU: number;
};

type UnloopUsageNativeModule = {
  hasUsagePermission(): boolean;
  openUsageAccessSettings(): void;
  hasOverlayPermission(): boolean;
  openOverlaySettings(): void;
  getUsageMsForPackage(packageName: string, startMs: number, endMs: number): number;
  bringAppToForeground(): void;
  dismissInterruptOverlay(): void;
  setCooldownUntilMs(epochMs: number): void;
  clearCooldown(): void;
  /** Comma-separated Android package names. */
  startNativeMonitoring(packagesCsv: string, thresholdMs: number): void;
  /** Hot-swap watch list while monitoring (keeps cooldown). */
  updateMonitoredPackages(packagesCsv: string): void;
  stopNativeMonitoring(): void;
  getMonitorSnapshot(): MonitorSnapshot;
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
  addListener(
    eventName: "onThresholdReached" | "onOpenChallenge",
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

export default UnloopUsage;
