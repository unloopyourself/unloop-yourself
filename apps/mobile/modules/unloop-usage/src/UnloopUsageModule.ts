import { requireNativeModule } from "expo";

export type ThresholdNativeEvent = {
  appId: string;
  deltaU: number;
  observedAtMs: number;
};

type UnloopUsageNativeModule = {
  hasUsagePermission(): boolean;
  openUsageAccessSettings(): void;
  hasOverlayPermission(): boolean;
  openOverlaySettings(): void;
  getUsageMsForPackage(packageName: string, startMs: number, endMs: number): number;
  bringAppToForeground(): void;
  dismissInterruptOverlay(): void;
  /** Comma-separated Android package names. */
  startNativeMonitoring(packagesCsv: string, thresholdMs: number): void;
  stopNativeMonitoring(): void;
  addListener(
    eventName: "onThresholdReached",
    listener: (event: ThresholdNativeEvent) => void,
  ): { remove: () => void };
};

const UnloopUsage = requireNativeModule("UnloopUsage") as UnloopUsageNativeModule;

export function addThresholdListener(
  listener: (event: ThresholdNativeEvent) => void,
): { remove: () => void } {
  return UnloopUsage.addListener("onThresholdReached", listener);
}

export default UnloopUsage;
