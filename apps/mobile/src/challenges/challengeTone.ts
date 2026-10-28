import { Platform } from "react-native";
import UnloopUsage from "../../modules/unloop-usage/src/UnloopUsageModule";

/** Avoid double beep when Open remounts ChallengeHost mid-tone. */
let lastToneStartedAtMs = 0;

/** Play a short challenge tone via the Android ToneGenerator adapter. */
export function playChallengeTone(durationMs = 10_000): boolean {
  if (Platform.OS !== "android") {
    return false;
  }
  const now = Date.now();
  if (now - lastToneStartedAtMs < Math.max(500, durationMs)) {
    return true;
  }
  try {
    const ok = UnloopUsage.playChallengeTone(durationMs);
    if (ok) {
      lastToneStartedAtMs = now;
    }
    return ok;
  } catch {
    return false;
  }
}

export function stopChallengeTone(): void {
  if (Platform.OS !== "android") {
    return;
  }
  try {
    UnloopUsage.stopChallengeTone();
  } catch {
    /* ignore */
  }
}
