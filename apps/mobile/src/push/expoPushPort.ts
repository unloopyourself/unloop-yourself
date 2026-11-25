import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import type { PushPort } from "@unloop/core";

/**
 * Android PushPort via expo-notifications (FCM under the hood).
 * No Firebase Analytics / Crashlytics / @react-native-firebase packages.
 */
export class ExpoPushPort implements PushPort {
  async getToken(): Promise<string | null> {
    if (Platform.OS !== "android") return null;
    if (!Device.isDevice) return null;

    const permission = await Notifications.getPermissionsAsync();
    let status = permission.status;
    if (status !== "granted") {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== "granted") return null;

    try {
      // Native FCM device token (not Expo push token) for Worker → FCM HTTP v1.
      const device = await Notifications.getDevicePushTokenAsync();
      if (device.type !== "android" || typeof device.data !== "string") {
        return null;
      }
      return device.data;
    } catch {
      return null;
    }
  }
}

/** Register device token on the relay for this mailbox (best-effort). */
export async function registerPushTokenWithRelay(
  relayBaseUrl: string,
  mailboxId: string,
  token: string,
): Promise<boolean> {
  try {
    const { HttpRelayPort } = await import("./httpRelayPort");
    await new HttpRelayPort(relayBaseUrl).registerPushToken(mailboxId, token);
    return true;
  } catch {
    return false;
  }
}

export function getRelayBaseUrl(): string | null {
  // Metro / Expo public env (optional). Fallback matches deployed Worker.
  const fromEnv =
    (typeof process !== "undefined" &&
      process.env?.EXPO_PUBLIC_UNLOOP_RELAY_URL) ||
    "";
  const url = String(fromEnv).trim();
  if (url) return url;
  return "https://unloop-relay.unloopyourself.workers.dev";
}
