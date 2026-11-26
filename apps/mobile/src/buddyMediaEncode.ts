import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { NUDGE_CAPS, type NudgeMediaInline } from "@unloop/core";

function approxBytesFromBase64(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

/**
 * Pick a library photo and compress under Phase 3.5 photo cap.
 */
export async function pickCompressedPhoto(): Promise<NudgeMediaInline | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
    allowsEditing: true,
    exif: false,
  });
  if (picked.canceled || !picked.assets[0]?.uri) return null;

  let width = 1280;
  let compress = 0.72;
  let last: NudgeMediaInline | null = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    const out = await ImageManipulator.manipulateAsync(
      picked.assets[0].uri,
      [{ resize: { width } }],
      {
        compress,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );
    if (!out.base64) return null;
    const byteLength = approxBytesFromBase64(out.base64);
    last = {
      encoding: "base64",
      mime: "image/jpeg",
      byteLength,
      data: out.base64,
    };
    if (byteLength <= NUDGE_CAPS.photoBytes) return last;
    width = Math.max(640, Math.floor(width * 0.75));
    compress = Math.max(0.35, compress - 0.1);
  }
  return last && last.byteLength <= NUDGE_CAPS.photoBytes ? last : null;
}

/**
 * Capture with camera (same compress path).
 */
export async function captureCompressedPhoto(): Promise<NudgeMediaInline | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;

  const picked = await ImagePicker.launchCameraAsync({
    quality: 1,
    allowsEditing: true,
    exif: false,
  });
  if (picked.canceled || !picked.assets[0]?.uri) return null;

  let width = 1280;
  let compress = 0.72;
  let last: NudgeMediaInline | null = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    const out = await ImageManipulator.manipulateAsync(
      picked.assets[0].uri,
      [{ resize: { width } }],
      {
        compress,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );
    if (!out.base64) return null;
    const byteLength = approxBytesFromBase64(out.base64);
    last = {
      encoding: "base64",
      mime: "image/jpeg",
      byteLength,
      data: out.base64,
    };
    if (byteLength <= NUDGE_CAPS.photoBytes) return last;
    width = Math.max(640, Math.floor(width * 0.75));
    compress = Math.max(0.35, compress - 0.1);
  }
  return last && last.byteLength <= NUDGE_CAPS.photoBytes ? last : null;
}

/**
 * Pick a GIF without re-encoding (keeps animation). Rejects files over gif cap.
 */
export async function pickGifUnderCap(): Promise<NudgeMediaInline | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
    exif: false,
  });
  if (picked.canceled || !picked.assets[0]?.uri) return null;

  const asset = picked.assets[0];
  const uri = asset.uri;
  const mime =
    asset.mimeType && asset.mimeType.startsWith("image/")
      ? asset.mimeType
      : uri.toLowerCase().includes(".gif")
        ? "image/gif"
        : "image/jpeg";

  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) return null;

  const data = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const byteLength =
    typeof info.size === "number" ? info.size : approxBytesFromBase64(data);
  if (byteLength > NUDGE_CAPS.gifBytes) return null;

  return {
    encoding: "base64",
    mime,
    byteLength,
    data,
  };
}
