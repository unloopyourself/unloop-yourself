import { describe, expect, it } from "vitest";
import {
  isChallengeCompatible,
  selectCompatibleChallenges,
  type Challenge,
  type Capability,
} from "./challenge.js";

function caps(...values: Capability[]): ReadonlySet<Capability> {
  return new Set(values);
}

describe("challenge capability selection", () => {
  const shake: Challenge = { id: "shake", requires: caps("accelerometer") };
  const reflection: Challenge = { id: "reflection", requires: caps() };
  const buddy: Challenge = {
    id: "buddy",
    requires: caps("buddy", "notifications", "media"),
  };

  it("accepts challenges whose requires are a subset of available capabilities", () => {
    const device = { availableCapabilities: caps("accelerometer", "pedometer") };
    expect(isChallengeCompatible(shake, device)).toBe(true);
    expect(isChallengeCompatible(reflection, device)).toBe(true);
    expect(isChallengeCompatible(buddy, device)).toBe(false);
  });

  it("excludes incompatible challenges before execution would matter", () => {
    const device = { availableCapabilities: caps("accelerometer") };
    expect(selectCompatibleChallenges([shake, reflection, buddy], device)).toEqual([
      shake,
      reflection,
    ]);
  });

  it("rejects when any required capability is missing", () => {
    const device = { availableCapabilities: caps("buddy", "notifications") };
    expect(isChallengeCompatible(buddy, device)).toBe(false);
  });
});
