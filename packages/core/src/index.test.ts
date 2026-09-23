import { describe, expect, it } from "vitest";
import { CORE_PACKAGE_NAME, corePackageInfo } from "./index.js";

describe("@unloop/core smoke", () => {
  it("exposes the package identity", () => {
    expect(CORE_PACKAGE_NAME).toBe("@unloop/core");
    expect(corePackageInfo()).toEqual({ name: "@unloop/core", version: "0.0.0" });
  });
});
