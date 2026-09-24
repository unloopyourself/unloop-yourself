import { Platform, StatusBar } from "react-native";

/** Top inset below the system status bar (battery / clock / etc.). */
export function statusBarTopInset(extra = 8): number {
  if (Platform.OS === "android") {
    return (StatusBar.currentHeight ?? 24) + extra;
  }
  // iOS notch handled later with safe-area when we ship Phase 2.
  return 48;
}
