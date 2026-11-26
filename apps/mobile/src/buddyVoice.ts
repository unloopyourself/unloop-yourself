import * as FileSystem from "expo-file-system/legacy";
import { NUDGE_CAPS, type NudgeMediaInline } from "@unloop/core";

function approxBytesFromBase64(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

/** Read a local recording URI into a capped voice media blob. */
export async function voiceFileToMedia(
  uri: string,
  durationMs: number,
): Promise<NudgeMediaInline | null> {
  if (durationMs <= 0 || durationMs > NUDGE_CAPS.voiceMaxMs) return null;
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) return null;
  const data = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const byteLength =
    typeof info.size === "number" ? info.size : approxBytesFromBase64(data);
  if (byteLength <= 0 || byteLength > NUDGE_CAPS.voiceBytes) return null;
  return {
    encoding: "base64",
    mime: "audio/mp4",
    byteLength,
    data,
  };
}

/** Persist base64 audio for expo-audio playback. */
export async function writeVoiceCacheFile(
  mime: string,
  data: string,
): Promise<string> {
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new Error("no_cache_dir");
  const ext =
    mime.includes("3gp") || mime.includes("3gpp")
      ? "3gp"
      : mime.includes("webm")
        ? "webm"
        : "m4a";
  const path = `${dir}buddy-voice-${Date.now()}.${ext}`;
  await FileSystem.writeAsStringAsync(path, data, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}
