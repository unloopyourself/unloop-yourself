import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";
import type { SoundPresetId } from "@unloop/core";
import type { Translate } from "../i18n";
import { colors, typography } from "../theme";
import {
  SOUND_PRESET_ASSETS,
  SOUND_PRESET_I18N_KEYS,
} from "../buddySoundPresets";
import { writeVideoCacheFile } from "../buddyMediaEncode";
import { writeVoiceCacheFile } from "../buddyVoice";

export type BuddyNudgeMedia = {
  readonly mime: string;
  readonly data: string;
};

type Props = {
  t: Translate;
  body: string;
  presetId?: SoundPresetId;
  media?: BuddyNudgeMedia;
  onContinue: () => void;
};

function PresetPlayer({ presetId }: { presetId: SoundPresetId }) {
  const player = useAudioPlayer(SOUND_PRESET_ASSETS[presetId]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        if (!cancelled) {
          player.seekTo(0);
          player.play();
        }
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [player, presetId]);
  return null;
}

function VoicePlayer({ uri }: { uri: string }) {
  const player = useAudioPlayer({ uri });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        if (!cancelled) {
          player.seekTo(0);
          player.play();
        }
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [player, uri]);
  return null;
}

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

function isAudioMime(mime: string): boolean {
  return mime.startsWith("audio/");
}

function isVideoMime(mime: string): boolean {
  return mime.startsWith("video/");
}

function NudgeVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls
    />
  );
}

/** Interrupt surface for a buddy nudge (text, photo/GIF, voice, sound preset). */
export function BuddyNudgeView({
  t,
  body,
  presetId,
  media,
  onContinue,
}: Props) {
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!media || !isAudioMime(media.mime)) {
      setVoiceUri(null);
      return;
    }
    void writeVoiceCacheFile(media.mime, media.data)
      .then((path) => {
        if (!cancelled) setVoiceUri(path);
      })
      .catch(() => {
        if (!cancelled) setVoiceUri(null);
      });
    return () => {
      cancelled = true;
    };
  }, [media]);

  useEffect(() => {
    let cancelled = false;
    if (!media || !isVideoMime(media.mime)) {
      setVideoUri(null);
      return;
    }
    void writeVideoCacheFile(media.mime, media.data)
      .then((path) => {
        if (!cancelled) setVideoUri(path);
      })
      .catch(() => {
        if (!cancelled) setVideoUri(null);
      });
    return () => {
      cancelled = true;
    };
  }, [media]);

  const imageUri =
    media && isImageMime(media.mime)
      ? `data:${media.mime};base64,${media.data}`
      : null;

  const caption =
    body &&
    !(presetId && body === presetId) &&
    !(presetId && body === "sound_preset") &&
    body !== "photo" &&
    body !== "gif" &&
    body !== "voice" &&
    body !== "video"
      ? body
      : presetId
        ? t(SOUND_PRESET_I18N_KEYS[presetId])
        : voiceUri
          ? t("buddy.nudge_voice")
          : videoUri
            ? t("buddy.nudge_video")
            : imageUri
              ? t("buddy.nudge_photo")
              : body;

  return (
    <View style={styles.wrap}>
      {presetId ? <PresetPlayer presetId={presetId} /> : null}
      {voiceUri ? <VoicePlayer uri={voiceUri} /> : null}
      <Text style={styles.eyebrow}>{t("buddy.nudge_from")}</Text>
      {presetId ? (
        <Text style={styles.preset}>{t("buddy.nudge_playing_sound")}</Text>
      ) : null}
      {voiceUri ? (
        <Text style={styles.preset}>{t("buddy.nudge_playing_voice")}</Text>
      ) : null}
      {videoUri ? (
        <Text style={styles.preset}>{t("buddy.nudge_playing_video")}</Text>
      ) : null}
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.photo}
          accessibilityLabel={t("buddy.nudge_photo")}
        />
      ) : null}
      {videoUri ? <NudgeVideoPlayer uri={videoUri} /> : null}
      <Text style={styles.body}>{caption}</Text>
      <Pressable
        style={styles.btn}
        onPress={onContinue}
        accessibilityRole="button"
      >
        <Text style={styles.btnLabel}>{t("buddy.nudge_continue")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    gap: 16,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(242,245,248,0.7)",
  },
  preset: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(242,245,248,0.55)",
  },
  photo: {
    width: "100%",
    maxWidth: 320,
    height: 220,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    resizeMode: "cover",
  },
  video: {
    width: "100%",
    maxWidth: 320,
    height: 220,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  body: {
    fontSize: typography.bodySize + 2,
    lineHeight: 26,
    fontWeight: "600",
    color: colors.textOnInk,
    textAlign: "center",
  },
  btn: {
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.ember,
  },
  btnLabel: { fontWeight: "800", color: colors.white, fontSize: 15 },
});
