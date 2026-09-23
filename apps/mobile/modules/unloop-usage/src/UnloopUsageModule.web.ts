import type { MonitorSnapshot, ThresholdNativeEvent } from "./UnloopUsageModule";

/** Web stub — usage detection is Android-first. */
const UnloopUsageModule = {
  hasUsagePermission(): boolean {
    return false;
  },
  openUsageAccessSettings(): void {
    /* no-op */
  },
  hasOverlayPermission(): boolean {
    return false;
  },
  openOverlaySettings(): void {
    /* no-op */
  },
  getUsageMsForPackage(_packageName: string, _startMs: number, _endMs: number): number {
    return -1;
  },
  bringAppToForeground(): void {
    /* no-op */
  },
  dismissInterruptOverlay(): void {
    /* no-op */
  },
  setCooldownUntilMs(_epochMs: number): void {
    /* no-op */
  },
  clearCooldown(): void {
    /* no-op */
  },
  startNativeMonitoring(_packagesCsv: string, _thresholdMs: number): void {
    /* no-op */
  },
  updateMonitoredPackages(_packagesCsv: string): void {
    /* no-op */
  },
  stopNativeMonitoring(): void {
    /* no-op */
  },
  getMonitorSnapshot(): MonitorSnapshot {
    return {
      monitoring: false,
      challengeOutstanding: false,
      inCooldown: false,
      cooldownUntilMs: 0,
      packagesCsv: "",
      lastAppId: "",
      lastDeltaU: 0,
    };
  },
};

export function addThresholdListener(
  _listener: (event: ThresholdNativeEvent) => void,
): { remove: () => void } {
  return { remove: () => undefined };
}

export function addOpenChallengeListener(_listener: () => void): { remove: () => void } {
  return { remove: () => undefined };
}

export default UnloopUsageModule;
