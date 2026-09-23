import type { StoragePort, UsageSnapshot } from "./ports.js";
import { computeDeltaU } from "./ports.js";

const BASELINE_KEY_PREFIX = "usage.baseline.";

export function baselineKey(appId: string): string {
  return `${BASELINE_KEY_PREFIX}${appId}`;
}

export async function loadBaseline(
  storage: StoragePort,
  appId: string,
): Promise<UsageSnapshot | null> {
  const raw = await storage.getString(baselineKey(appId));
  if (!raw) {
    return null;
  }
  const parsed = JSON.parse(raw) as UsageSnapshot;
  return parsed;
}

export async function saveBaseline(
  storage: StoragePort,
  snapshot: UsageSnapshot,
): Promise<void> {
  await storage.setString(baselineKey(snapshot.appId), JSON.stringify(snapshot));
}

export async function clearBaseline(storage: StoragePort, appId: string): Promise<void> {
  await storage.remove(baselineKey(appId));
}

/**
 * Persist U1 on first observation; later return ΔU against that baseline.
 * Reconstructs after restart via StoragePort.
 */
export async function observeUsageDelta(
  storage: StoragePort,
  current: UsageSnapshot,
): Promise<{ deltaU: number; baseline: UsageSnapshot }> {
  let baseline = await loadBaseline(storage, current.appId);
  if (!baseline) {
    baseline = current;
    await saveBaseline(storage, baseline);
  }
  return {
    deltaU: computeDeltaU(current.usageUnits, baseline.usageUnits),
    baseline,
  };
}
