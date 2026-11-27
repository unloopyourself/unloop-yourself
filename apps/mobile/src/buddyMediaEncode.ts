import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NUDGE_CAPS, type NudgeMediaInline } from "@unloop/core";

export type VideoNudgeMedia = NudgeMediaInline & {
  readonly durationMs: number;
};

/** Survives MainActivity death while the system camera is open (common on low-RAM OEMs). */
const CAMERA_VIDEO_INTENT_KEY = "@unloop/cameraVideoIntent/v1";

export type CameraVideoIntent = {
  readonly mode: "stage" | "compose";
  readonly caption?: string;
  readonly atMs: number;
};

const CAMERA_INTENT_TTL_MS = 10 * 60 * 1000;

export async function markCameraVideoIntent(
  intent: Omit<CameraVideoIntent, "atMs"> & { atMs?: number },
): Promise<void> {
  const full: CameraVideoIntent = {
    mode: intent.mode,
    ...(intent.caption ? { caption: intent.caption } : {}),
    atMs: intent.atMs ?? Date.now(),
  };
  await AsyncStorage.setItem(CAMERA_VIDEO_INTENT_KEY, JSON.stringify(full));
}

export async function clearCameraVideoIntent(): Promise<void> {
  await AsyncStorage.removeItem(CAMERA_VIDEO_INTENT_KEY);
}

export async function peekCameraVideoIntent(): Promise<CameraVideoIntent | null> {
  try {
    const raw = await AsyncStorage.getItem(CAMERA_VIDEO_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CameraVideoIntent;
    if (parsed?.mode !== "stage" && parsed?.mode !== "compose") {
      await clearCameraVideoIntent();
      return null;
    }
    if (
      typeof parsed.atMs !== "number" ||
      Date.now() - parsed.atMs > CAMERA_INTENT_TTL_MS
    ) {
      await clearCameraVideoIntent();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isPickerError(
  value: ImagePicker.ImagePickerResult | ImagePicker.ImagePickerErrorResult,
): value is ImagePicker.ImagePickerErrorResult {
  return typeof value === "object" && value != null && "code" in value;
}

/**
 * Android may kill MainActivity while the camera UI is open. The original
 * launch* promise then returns canceled — recover via getPendingResultAsync.
 */
async function firstPickerAsset(
  primary: ImagePicker.ImagePickerResult,
): Promise<ImagePicker.ImagePickerAsset | null> {
  if (!primary.canceled && primary.assets?.[0]?.uri) {
    return primary.assets[0];
  }
  try {
    const pending = await ImagePicker.getPendingResultAsync();
    if (!pending || isPickerError(pending)) return null;
    if (pending.canceled || !pending.assets?.[0]?.uri) return null;
    return pending.assets[0];
  } catch {
    return null;
  }
}

/** Copy content:// (and other non-cache) URIs so FileSystem can read them. */
async function materializeLocalUri(
  uri: string,
  ext: string,
): Promise<string> {
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) return uri;
  if (uri.startsWith(dir)) return uri;

  const dest = `${dir}buddy-media-${Date.now()}.${ext}`;
  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

function extFromMimeOrUri(
  mime: string | null | undefined,
  uri: string,
  fallback: string,
): string {
  if (mime?.includes("webm")) return "webm";
  if (mime?.includes("mp4") || mime?.includes("quicktime")) return "mp4";
  if (mime?.includes("jpeg") || mime?.includes("jpg")) return "jpg";
  if (mime?.includes("png")) return "png";
  if (mime?.includes("gif")) return "gif";
  const m = /\.([a-z0-9]+)(?:\?|$)/i.exec(uri);
  if (m?.[1]) return m[1].toLowerCase();
  return fallback;
}

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

/**
 * ImagePicker `duration` is ms on most builds; some OEMs report seconds.
 * Values ≤ 180 are treated as seconds.
 */
export function normalizeVideoDurationMs(
  hint: number | null | undefined,
): number | null {
  if (hint == null || !Number.isFinite(hint) || hint <= 0) return null;
  if (hint <= 180) return Math.round(hint * 1000);
  return Math.round(hint);
}

export type VideoPickFailure =
  | "cancel"
  | "perm"
  | "too_big"
  | "too_long"
  | "read_fail";

export type VideoPickResult =
  | { ok: true; media: VideoNudgeMedia }
  | { ok: false; reason: VideoPickFailure };

export function videoPickFailureI18nKey(
  reason: VideoPickFailure,
):
  | "buddy.compose_video_cancel"
  | "buddy.compose_video_perm"
  | "buddy.compose_video_too_big"
  | "buddy.compose_video_too_long"
  | "buddy.compose_video_read_fail" {
  switch (reason) {
    case "perm":
      return "buddy.compose_video_perm";
    case "too_big":
      return "buddy.compose_video_too_big";
    case "too_long":
      return "buddy.compose_video_too_long";
    case "read_fail":
      return "buddy.compose_video_read_fail";
    default:
      return "buddy.compose_video_cancel";
  }
}

async function videoAssetToResult(
  uri: string,
  mimeHint: string | null | undefined,
  durationHint: number | null | undefined,
): Promise<VideoPickResult> {
  const ext = extFromMimeOrUri(mimeHint, uri, "mp4");
  const localUri = await materializeLocalUri(uri, ext);

  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists || info.isDirectory) return { ok: false, reason: "read_fail" };

  const durationMs = normalizeVideoDurationMs(durationHint);
  if (durationMs != null && durationMs > NUDGE_CAPS.videoMaxMs + 1500) {
    return { ok: false, reason: "too_long" };
  }

  const byteLength = typeof info.size === "number" ? info.size : 0;
  if (byteLength > NUDGE_CAPS.videoBytes) {
    return { ok: false, reason: "too_big" };
  }

  let data: string;
  try {
    data = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return { ok: false, reason: "read_fail" };
  }
  const resolvedBytes =
    byteLength > 0 ? byteLength : approxBytesFromBase64(data);
  if (resolvedBytes <= 0) return { ok: false, reason: "read_fail" };
  if (resolvedBytes > NUDGE_CAPS.videoBytes) {
    return { ok: false, reason: "too_big" };
  }

  const mime =
    mimeHint && mimeHint.startsWith("video/")
      ? mimeHint
      : "video/mp4";

  return {
    ok: true,
    media: {
      encoding: "base64",
      mime,
      byteLength: resolvedBytes,
      data,
      durationMs:
        durationMs != null && durationMs > 0
          ? Math.min(NUDGE_CAPS.videoMaxMs, durationMs)
          : NUDGE_CAPS.videoMaxMs,
    },
  };
}

/**
 * Pick a short video (≤10s / ≤8 MiB). No FFmpeg re-encode — oversize is rejected.
 */
export async function pickVideoUnderCap(): Promise<VideoPickResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: "perm" };

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["videos"],
    videoMaxDuration: Math.floor(NUDGE_CAPS.videoMaxMs / 1000),
    quality: 0.5,
    exif: false,
  });
  const a = await firstPickerAsset(picked);
  if (!a) return { ok: false, reason: "cancel" };
  return videoAssetToResult(a.uri, a.mimeType, a.duration);
}

/**
 * Capture a short video (≤10s / ≤8 MiB). Device may still produce large files —
 * we reject if over cap (no paid/cloud compress).
 *
 * On low-RAM Androids (e.g. Nokia 3.2) MainActivity may die while the OEM
 * camera is open — mark intent so remount can call {@link recoverPendingCameraVideo}.
 */
export async function captureVideoUnderCap(
  intent: Omit<CameraVideoIntent, "atMs"> & { atMs?: number } = {
    mode: "stage",
  },
): Promise<VideoPickResult> {
  const cam = await ImagePicker.requestCameraPermissionsAsync();
  if (!cam.granted) return { ok: false, reason: "perm" };
  // Video with audio needs mic on many OEMs.
  try {
    const { requestRecordingPermissionsAsync } = await import("expo-audio");
    await requestRecordingPermissionsAsync();
  } catch {
    /* optional */
  }

  await markCameraVideoIntent(intent);
  const picked = await ImagePicker.launchCameraAsync({
    mediaTypes: ["videos"],
    videoMaxDuration: Math.floor(NUDGE_CAPS.videoMaxMs / 1000),
    quality: 0.4,
    exif: false,
  });
  let a = await firstPickerAsset(picked);
  if (!a) {
    // Some OEMs publish the pending result slightly after the canceled callback.
    await new Promise((r) => setTimeout(r, 500));
    a = await firstPickerAsset({ canceled: true, assets: null });
  }
  if (!a) {
    // Keep intent — AppState remount may still reclaim a late pending result.
    return { ok: false, reason: "cancel" };
  }
  const result = await videoAssetToResult(a.uri, a.mimeType, a.duration);
  await clearCameraVideoIntent();
  return result;
}

function assetLooksLikeVideo(a: ImagePicker.ImagePickerAsset): boolean {
  if (a.type === "video") return true;
  if (a.mimeType?.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|m4v|3gp)(?:\?|$)/i.test(a.uri);
}

/**
 * After Android kills MainActivity during camera, call on screen remount /
 * AppState active to reclaim the recorded video.
 */
export async function recoverPendingCameraVideo(): Promise<{
  media: VideoNudgeMedia;
  intent: CameraVideoIntent;
} | null> {
  const intent = await peekCameraVideoIntent();

  let pending: Awaited<ReturnType<typeof ImagePicker.getPendingResultAsync>>;
  try {
    pending = await ImagePicker.getPendingResultAsync();
  } catch {
    return null;
  }
  // Keep intent if nothing to consume yet (camera still open / not ready).
  if (!pending) return null;
  if (isPickerError(pending)) {
    await clearCameraVideoIntent();
    return null;
  }
  if (pending.canceled || !pending.assets?.[0]?.uri) {
    await clearCameraVideoIntent();
    return null;
  }

  const a = pending.assets[0];
  if (!intent && !assetLooksLikeVideo(a)) return null;

  await clearCameraVideoIntent();
  const result = await videoAssetToResult(a.uri, a.mimeType, a.duration);
  if (!result.ok) return null;
  return {
    media: result.media,
    intent: intent ?? { mode: "stage", atMs: Date.now() },
  };
}

/** Persist base64 video for expo-video playback. */
export async function writeVideoCacheFile(
  mime: string,
  data: string,
): Promise<string> {
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new Error("no_cache_dir");
  const ext = mime.includes("webm") ? "webm" : "mp4";
  const path = `${dir}buddy-video-${Date.now()}.${ext}`;
  await FileSystem.writeAsStringAsync(path, data, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}
