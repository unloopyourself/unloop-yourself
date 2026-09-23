import type { StoragePort } from "@unloop/core";

/** AsyncStorage-free MVP KV using in-memory map; swap for secure local KV in P1-03 follow-up on device. */
export class MemoryStoragePort implements StoragePort {
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
