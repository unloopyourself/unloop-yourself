import { describe, expect, it } from "vitest";
import { InMemoryStoragePort } from "./ports.js";
import { clearBaseline, observeUsageDelta } from "./persistence.js";

describe("usage baseline persistence", () => {
  it("stores U1 on first observation and computes ΔU later", async () => {
    const storage = new InMemoryStoragePort();
    const first = await observeUsageDelta(storage, {
      appId: "reels",
      usageUnits: 100,
      observedAtMs: 1,
    });
    expect(first.deltaU).toBe(0);
    expect(first.baseline.usageUnits).toBe(100);

    const second = await observeUsageDelta(storage, {
      appId: "reels",
      usageUnits: 130,
      observedAtMs: 2,
    });
    expect(second.deltaU).toBe(30);
    expect(second.baseline.usageUnits).toBe(100);
  });

  it("reconstructs baseline after a fresh storage read (restart)", async () => {
    const storage = new InMemoryStoragePort();
    await observeUsageDelta(storage, {
      appId: "shorts",
      usageUnits: 50,
      observedAtMs: 1,
    });
    // Same storage instance simulates persisted KV surviving process restart.
    const afterRestart = await observeUsageDelta(storage, {
      appId: "shorts",
      usageUnits: 80,
      observedAtMs: 2,
    });
    expect(afterRestart.deltaU).toBe(30);
  });

  it("clears baseline", async () => {
    const storage = new InMemoryStoragePort();
    await observeUsageDelta(storage, {
      appId: "tiktok",
      usageUnits: 10,
      observedAtMs: 1,
    });
    await clearBaseline(storage, "tiktok");
    const again = await observeUsageDelta(storage, {
      appId: "tiktok",
      usageUnits: 40,
      observedAtMs: 2,
    });
    expect(again.deltaU).toBe(0);
    expect(again.baseline.usageUnits).toBe(40);
  });
});
