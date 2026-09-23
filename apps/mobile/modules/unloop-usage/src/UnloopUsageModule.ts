import { NativeModule, requireNativeModule } from "expo";

export type UnloopUsageNativeModule = NativeModule & {
  hasUsagePermission(): boolean;
  openUsageAccessSettings(): void;
  getUsageMsForPackage(packageName: string, startMs: number, endMs: number): number;
};

export default requireNativeModule<UnloopUsageNativeModule>("UnloopUsage");
