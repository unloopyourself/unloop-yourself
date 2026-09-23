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
  startNativeMonitoring(_packageName: string, _thresholdMs: number): void {
    /* no-op */
  },
  stopNativeMonitoring(): void {
    /* no-op */
  },
};

export function addThresholdListener(_listener: (event: unknown) => void): { remove: () => void } {
  return { remove: () => undefined };
}

export default UnloopUsageModule;
