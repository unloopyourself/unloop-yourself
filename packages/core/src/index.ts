/** Unloop core package entry — domain logic only (no React Native / Expo). */

export const CORE_PACKAGE_NAME = "@unloop/core" as const;

export function corePackageInfo(): { name: typeof CORE_PACKAGE_NAME; version: string } {
  return { name: CORE_PACKAGE_NAME, version: "0.0.0" };
}
