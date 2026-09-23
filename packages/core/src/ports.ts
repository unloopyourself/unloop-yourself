import type { Capability } from "./challenge.js";

/** Cumulative usage snapshot for ΔU calculation (platform-agnostic units). */
export interface UsageSnapshot {
  readonly appId: string;
  readonly usageUnits: number;
  readonly observedAtMs: number;
}

export interface ThresholdConfig {
  readonly appId: string;
  readonly thresholdUnits: number;
}

export interface UsageThresholdEvent {
  readonly appId: string;
  readonly deltaU: number;
  readonly observedAtMs: number;
}

export interface UsageDetectorPort {
  start(config: ThresholdConfig): Promise<void>;
  stop(): Promise<void>;
}

export interface StoragePort {
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface SensorReading {
  readonly capability: Capability;
  readonly value: number;
  readonly observedAtMs: number;
}

export interface SensorPort {
  isAvailable(capability: Capability): Promise<boolean>;
  read(capability: Capability): Promise<SensorReading | null>;
}

export interface NotificationPort {
  notify(title: string, body: string): Promise<void>;
}

/** In-memory StoragePort for Core tests. */
export class InMemoryStoragePort implements StoragePort {
  private readonly data = new Map<string, string>();

  async getString(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async setString(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }
}

/** ΔU = U_now - U_1 */
export function computeDeltaU(uNow: number, uBaseline: number): number {
  return uNow - uBaseline;
}
