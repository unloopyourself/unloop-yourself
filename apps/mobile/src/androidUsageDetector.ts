import { Platform } from "react-native";
import type {
  ThresholdConfig,
  UsageDetectorPort,
  UsageThresholdEvent,
} from "@unloop/core";
import { observeUsageDelta } from "@unloop/core";
import type { StoragePort } from "@unloop/core";
import UnloopUsage from "../modules/unloop-usage/src/UnloopUsageModule";

export type ThresholdListener = (event: UsageThresholdEvent) => void;

/**
 * Android UsageStats-backed detector. Debug builds may run a JS poll while the
 * Unloop process is alive; a Foreground Service will harden background later.
 */
export class AndroidUsageDetector implements UsageDetectorPort {
  private timer: ReturnType<typeof setInterval> | null = null;
  private config: ThresholdConfig | null = null;
  private readonly dayStartMs: number;

  constructor(
    private readonly storage: StoragePort,
    private readonly onThreshold: ThresholdListener,
    private readonly pollIntervalMs = 5_000,
  ) {
    const now = new Date();
    this.dayStartMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  async start(config: ThresholdConfig): Promise<void> {
    if (Platform.OS !== "android") {
      throw new Error("AndroidUsageDetector is Android-only");
    }
    this.config = config;
    this.stopPolling();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
    await this.tick();
  }

  async stop(): Promise<void> {
    this.stopPolling();
    this.config = null;
  }

  hasPermission(): boolean {
    return UnloopUsage.hasUsagePermission();
  }

  openSettings(): void {
    UnloopUsage.openUsageAccessSettings();
  }

  private stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    const config = this.config;
    if (!config) {
      return;
    }
    if (!UnloopUsage.hasUsagePermission()) {
      return;
    }
    const endMs = Date.now();
    const usageMs = UnloopUsage.getUsageMsForPackage(config.appId, this.dayStartMs, endMs);
    if (usageMs < 0) {
      return;
    }
    const { deltaU } = await observeUsageDelta(this.storage, {
      appId: config.appId,
      usageUnits: usageMs,
      observedAtMs: endMs,
    });
    if (deltaU >= config.thresholdUnits) {
      this.onThreshold({
        appId: config.appId,
        deltaU,
        observedAtMs: endMs,
      });
    }
  }
}
