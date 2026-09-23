/** Web stub — usage detection is Android-first. */
const UnloopUsageModule = {
  hasUsagePermission(): boolean {
    return false;
  },
  openUsageAccessSettings(): void {
    /* no-op */
  },
  getUsageMsForPackage(_packageName: string, _startMs: number, _endMs: number): number {
    return -1;
  },
};

export default UnloopUsageModule;
