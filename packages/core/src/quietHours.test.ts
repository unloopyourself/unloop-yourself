import { describe, expect, it } from "vitest";
import { isInQuietHours } from "./quietHours.js";

describe("isInQuietHours", () => {
  it("overnight window", () => {
    expect(isInQuietHours(23, 22, 8)).toBe(true);
    expect(isInQuietHours(7, 22, 8)).toBe(true);
    expect(isInQuietHours(8, 22, 8)).toBe(false);
    expect(isInQuietHours(10, 22, 8)).toBe(false);
  });

  it("same-day window", () => {
    expect(isInQuietHours(14, 13, 17)).toBe(true);
    expect(isInQuietHours(12, 13, 17)).toBe(false);
  });

  it("empty when start===end", () => {
    expect(isInQuietHours(3, 5, 5)).toBe(false);
  });
});
