import { describe, expect, it } from "vitest";
import { computeDeltaU, InMemoryStoragePort } from "./ports.js";

describe("ports and ΔU", () => {
  it("computes delta usage", () => {
    expect(computeDeltaU(120, 90)).toBe(30);
  });

  it("persists strings in the fake storage adapter", async () => {
    const storage = new InMemoryStoragePort();
    await storage.setString("baseline", "42");
    expect(await storage.getString("baseline")).toBe("42");
    await storage.remove("baseline");
    expect(await storage.getString("baseline")).toBeNull();
  });
});
