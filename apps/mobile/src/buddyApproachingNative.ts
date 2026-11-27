import { Platform } from "react-native";
import UnloopUsage from "../modules/unloop-usage/src/UnloopUsageModule";
import { loadBuddies, loadOrCreateIdentity } from "./buddyStore";
import { getRelayBaseUrl } from "./push/expoPushPort";
import type { UnloopSettings } from "./settings";
import { MIN_BUDDY_WARN_LEAD_MS } from "./buddySettings";

/**
 * Effective approaching lead: at least 2 minutes before threshold, never
 * longer than the threshold itself.
 */
export function effectiveBuddyWarnLeadMs(settings: UnloopSettings): number {
  const lead = Math.max(MIN_BUDDY_WARN_LEAD_MS, settings.buddyWarnLeadMs);
  return Math.min(lead, Math.max(0, settings.thresholdMs));
}

/**
 * Push Buddy approaching targets into the native usage FGS so notify still
 * fires while Unloop is backgrounded (JS timers are paused).
 */
export async function syncBuddyApproachingNative(
  settings: UnloopSettings | null,
): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const relay = getRelayBaseUrl() ?? "";
    if (!settings?.buddyEnabled || !relay) {
      UnloopUsage.syncBuddyApproachingConfig(false, 0, "", "", "");
      return;
    }
    const [identity, buddies] = await Promise.all([
      loadOrCreateIdentity(),
      loadBuddies(),
    ]);
    const notifyCsv = buddies
      .filter((b) => b.notifyApproaching === true && b.acceptNudges !== false)
      .map((b) => b.mailboxId)
      .join(",");
    UnloopUsage.syncBuddyApproachingConfig(
      notifyCsv.length > 0,
      effectiveBuddyWarnLeadMs(settings),
      relay,
      identity.mailboxId,
      notifyCsv,
    );
  } catch {
    /* best-effort */
  }
}

/** Align NudgeBus eventId with the native bout (mailbox put/get key). */
export function readNativeBuddyEventId(): string | null {
  if (Platform.OS !== "android") return null;
  try {
    const state = UnloopUsage.getBuddyApproachingState();
    const id = String(state.eventId ?? "").trim();
    return id || null;
  } catch {
    return null;
  }
}
