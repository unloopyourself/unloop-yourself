import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { NudgeMediaInline } from "@unloop/core";

/** Bundled reaction GIFs (tiny looped stickers). */
export const BUILTIN_GIF_STICKERS = [
  {
    id: "wave",
    module: require("../assets/buddy-stickers/wave.gif"),
    labelKey: "buddy.sticker_wave" as const,
  },
  {
    id: "lol",
    module: require("../assets/buddy-stickers/lol.gif"),
    labelKey: "buddy.sticker_lol" as const,
  },
  {
    id: "coffee",
    module: require("../assets/buddy-stickers/coffee.gif"),
    labelKey: "buddy.sticker_coffee" as const,
  },
  {
    id: "alarm",
    module: require("../assets/buddy-stickers/alarm.gif"),
    labelKey: "buddy.sticker_alarm" as const,
  },
  {
    id: "clap",
    module: require("../assets/buddy-stickers/clap.gif"),
    labelKey: "buddy.sticker_clap" as const,
  },
] as const;

export type BuiltinGifId = (typeof BUILTIN_GIF_STICKERS)[number]["id"];

/** Built-in emoticon nudges (sent as short text). */
export const BUILTIN_EMOTICONS = [
  { id: "cool", emoji: "😎" },
  { id: "joy", emoji: "😂" },
  { id: "flex", emoji: "💪" },
  { id: "eyes", emoji: "👀" },
  { id: "heart", emoji: "🫶" },
] as const;

export type BuiltinEmoticonId = (typeof BUILTIN_EMOTICONS)[number]["id"];

function approxBytesFromBase64(data: string): number {
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((data.length * 3) / 4) - padding);
}

/** Resolve a bundled GIF into inline nudge media (base64). */
export async function loadBuiltinGifMedia(
  moduleId: number,
): Promise<NudgeMediaInline | null> {
  try {
    const asset = Asset.fromModule(moduleId);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) return null;
    const data = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!data) return null;
    const byteLength = approxBytesFromBase64(data);
    return {
      encoding: "base64",
      mime: "image/gif",
      byteLength,
      data,
    };
  } catch {
    return null;
  }
}
