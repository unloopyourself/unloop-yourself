import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUDDY_LOCKOUT_LEAD_MS,
  isPastLockout,
  lockoutAtMs,
  nextRoundRobinIndex,
} from "./buddyLockout.js";

describe("buddyLockout", () => {
  it("lockout is interruptAt − lead", () => {
    expect(lockoutAtMs(100_000, 30_000)).toBe(70_000);
    expect(lockoutAtMs(100_000)).toBe(100_000 - DEFAULT_BUDDY_LOCKOUT_LEAD_MS);
  });

  it("isPastLockout respects lead window", () => {
    expect(isPastLockout(69_999, 100_000, 30_000)).toBe(false);
    expect(isPastLockout(70_000, 100_000, 30_000)).toBe(true);
  });

  it("round-robin wraps", () => {
    expect(nextRoundRobinIndex(0, -1)).toBe(-1);
    expect(nextRoundRobinIndex(3, -1)).toBe(0);
    expect(nextRoundRobinIndex(3, 0)).toBe(1);
    expect(nextRoundRobinIndex(3, 2)).toBe(0);
    expect(nextRoundRobinIndex(3, 99)).toBe(0);
  });
});
