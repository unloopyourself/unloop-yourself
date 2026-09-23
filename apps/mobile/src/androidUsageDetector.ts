import { Platform } from "react-native";
import type { ThresholdConfig, UsageDetectorPort, UsageThresholdEvent } from "@unloop/core";
import UnloopUsage, {
  addThresholdListener,
} from "../modules/unloop-usage/src/UnloopUsageModule";

export type ThresholdListener = (event: UsageThresholdEvent) => void;

/**
 * Android UsageStats detector backed by a native Foreground Service so polling
 * continues while another app (e.g. YouTube) is in the foreground.
 * `appId` may be a comma-separated list of package names.
 */
export class AndroidUsageDetector implements UsageDetectorPort {
  private subscription: { remove: () => void } | null = null;

  constructor(private readonly onThreshold: ThresholdListener) {}

  async start(config: ThresholdConfig): Promise<void> {
    if (Platform.OS !== "android") {
      throw new Error("AndroidUsageDetector is Android-only");
    }
    this.subscription?.remove();
    this.subscription = addThresholdListener((event) => {
      this.onThreshold({
        appId: event.appId,
        deltaU: event.deltaU,
        observedAtMs: event.observedAtMs,
      });
    });
    UnloopUsage.startNativeMonitoring(config.appId, config.thresholdUnits);
  }

  async stop(): Promise<void> {
    this.subscription?.remove();
    this.subscription = null;
    if (Platform.OS === "android") {
      UnloopUsage.stopNativeMonitoring();
      UnloopUsage.dismissInterruptOverlay();
    }
  }

  hasPermission(): boolean {
    return UnloopUsage.hasUsagePermission();
  }

  hasOverlayPermission(): boolean {
    return Platform.OS === "android" && UnloopUsage.hasOverlayPermission();
  }

  openSettings(): void {
    UnloopUsage.openUsageAccessSettings();
  }

  openOverlaySettings(): void {
    UnloopUsage.openOverlaySettings();
  }
}
