import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Translate } from "../i18n";
import { colors, typography } from "../theme";
import { statusBarTopInset } from "../layout";
import {
  encodeNudgeEnvelope,
  soundPresetNudgeEnvelope,
  SOUND_PRESET_IDS,
  type NudgeMediaInline,
  type SoundPresetId,
} from "@unloop/core";
import {
  addStagedMedia,
  addStagedNudge,
  addStagedPreset,
  encodeNudgeBlob,
  encodeStagedNudgeCipher,
  loadStagedNudges,
  removeStagedNudge,
  type PendingApproach,
  type StagedNudge,
} from "../buddyNudgeStore";
import {
  captureCompressedPhoto,
  captureVideoUnderCap,
  pickCompressedPhoto,
  pickGifUnderCap,
  pickVideoUnderCap,
  videoPickFailureI18nKey,
  type VideoNudgeMedia,
} from "../buddyMediaEncode";
import {
  SOUND_PRESET_I18N_KEYS,
} from "../buddySoundPresets";
import { BuddyVoiceRecorder } from "./BuddyVoiceRecorder";
import { StagedNudgeRow } from "./StagedNudgePreview";
import { HttpRelayPort } from "../push/httpRelayPort";
import { getRelayBaseUrl } from "../push/expoPushPort";

type Props = {
  t: Translate;
  pending: PendingApproach;
  defaultNudge: string;
  onDone: () => void;
  onBack: () => void;
};

export function BuddyComposeScreen({
  t,
  pending,
  defaultNudge,
  onDone,
  onBack,
}: Props) {
  const [staged, setStaged] = useState<StagedNudge[]>([]);
  const [live, setLive] = useState("");
  const [photo, setPhoto] = useState<NudgeMediaInline | null>(null);
  const [gif, setGif] = useState<NudgeMediaInline | null>(null);
  const [voice, setVoice] = useState<{
    media: NudgeMediaInline;
    durationMs: number;
  } | null>(null);
  const [video, setVideo] = useState<VideoNudgeMedia | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadStagedNudges().then(setStaged);
  }, []);

  const putCipher = useCallback(
    async (ciphertext: string) => {
      const relayUrl = getRelayBaseUrl();
      if (!relayUrl) {
        setStatus(t("buddy.compose_no_relay"));
        return;
      }
      setBusy(true);
      try {
        const relay = new HttpRelayPort(relayUrl);
        await relay.putMailbox(
          pending.mailboxId,
          pending.eventId,
          ciphertext,
          180,
        );
        setStatus(t("buddy.compose_sent"));
        onDone();
      } catch {
        setStatus(t("buddy.compose_fail"));
      } finally {
        setBusy(false);
      }
    },
    [onDone, pending.eventId, pending.mailboxId, t],
  );

  const upload = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed) {
        setStatus(t("buddy.compose_empty"));
        return;
      }
      await putCipher(encodeNudgeBlob(trimmed));
    },
    [putCipher, t],
  );

  const uploadStaged = useCallback(
    async (row: StagedNudge) => {
      setStatus(null);
      setBusy(true);
      let cipher: string | null = null;
      try {
        cipher = await encodeStagedNudgeCipher(row);
      } catch {
        setStatus(t("buddy.compose_fail"));
        setBusy(false);
        return;
      }
      setBusy(false);
      if (!cipher) {
        setStatus(t("buddy.compose_staged_missing"));
        return;
      }
      await putCipher(cipher);
    },
    [putCipher, t],
  );

  const savePhotoStaged = useCallback(async () => {
    if (!photo) {
      setStatus(t("buddy.compose_photo_needed"));
      return;
    }
    const next = await addStagedMedia({
      kind: "photo",
      media: photo,
      caption: live.trim() || undefined,
    });
    setStaged(next);
    setStatus(t("buddy.compose_staged_saved"));
  }, [live, photo, t]);

  const saveGifStaged = useCallback(async () => {
    if (!gif) {
      setStatus(t("buddy.compose_gif_needed"));
      return;
    }
    const next = await addStagedMedia({
      kind: "gif",
      media: gif,
      caption: live.trim() || undefined,
    });
    setStaged(next);
    setStatus(t("buddy.compose_staged_saved"));
  }, [gif, live, t]);

  const saveVoiceStaged = useCallback(async () => {
    if (!voice) {
      setStatus(t("buddy.compose_voice_needed"));
      return;
    }
    const next = await addStagedMedia({
      kind: "voice",
      media: voice.media,
      durationMs: voice.durationMs,
      caption: live.trim() || undefined,
    });
    setStaged(next);
    setStatus(t("buddy.compose_staged_saved"));
  }, [live, t, voice]);

  const saveVideoStaged = useCallback(async () => {
    if (!video) {
      setStatus(t("buddy.compose_video_needed"));
      return;
    }
    const next = await addStagedMedia({
      kind: "video",
      media: {
        encoding: video.encoding,
        mime: video.mime,
        byteLength: video.byteLength,
        data: video.data,
      },
      durationMs: video.durationMs,
      caption: live.trim() || undefined,
    });
    setStaged(next);
    setStatus(t("buddy.compose_staged_saved"));
  }, [live, t, video]);

  const uploadPreset = useCallback(
    async (presetId: SoundPresetId) => {
      const caption = live.trim() || undefined;
      await putCipher(
        encodeNudgeEnvelope(soundPresetNudgeEnvelope(presetId, caption)),
      );
    },
    [live, putCipher],
  );

  const savePresetStaged = useCallback(
    async (presetId: SoundPresetId) => {
      const next = await addStagedPreset(presetId, live.trim() || undefined);
      setStaged(next);
      setStatus(t("buddy.compose_staged_saved"));
    },
    [live, t],
  );

  const uploadPhoto = useCallback(async () => {
    if (!photo) {
      setStatus(t("buddy.compose_photo_needed"));
      return;
    }
    const caption = live.trim() || undefined;
    try {
      await putCipher(
        encodeNudgeEnvelope({
          v: 1,
          kind: "photo",
          atMs: Date.now(),
          ...(caption ? { text: caption } : {}),
          media: photo,
        }),
      );
    } catch {
      setStatus(t("buddy.compose_photo_too_big"));
    }
  }, [live, photo, putCipher, t]);

  const onPickPhoto = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const media = await pickCompressedPhoto();
      if (!media) {
        setStatus(t("buddy.compose_photo_cancel"));
        return;
      }
      setGif(null);
      setVoice(null);
      setVideo(null);
      setPhoto(media);
      setStatus(t("buddy.compose_photo_ready"));
    } finally {
      setBusy(false);
    }
  }, [t]);

  const onCapturePhoto = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const media = await captureCompressedPhoto();
      if (!media) {
        setStatus(t("buddy.compose_photo_cancel"));
        return;
      }
      setGif(null);
      setVoice(null);
      setVideo(null);
      setPhoto(media);
      setStatus(t("buddy.compose_photo_ready"));
    } finally {
      setBusy(false);
    }
  }, [t]);

  const uploadGif = useCallback(async () => {
    if (!gif) {
      setStatus(t("buddy.compose_gif_needed"));
      return;
    }
    const caption = live.trim() || undefined;
    try {
      await putCipher(
        encodeNudgeEnvelope({
          v: 1,
          kind: "gif",
          atMs: Date.now(),
          ...(caption ? { text: caption } : {}),
          media: gif,
        }),
      );
    } catch {
      setStatus(t("buddy.compose_gif_too_big"));
    }
  }, [gif, live, putCipher, t]);

  const uploadVideo = useCallback(async () => {
    if (!video) {
      setStatus(t("buddy.compose_video_needed"));
      return;
    }
    const caption = live.trim() || undefined;
    try {
      await putCipher(
        encodeNudgeEnvelope({
          v: 1,
          kind: "video",
          atMs: Date.now(),
          durationMs: video.durationMs,
          ...(caption ? { text: caption } : {}),
          media: {
            encoding: video.encoding,
            mime: video.mime,
            byteLength: video.byteLength,
            data: video.data,
          },
        }),
      );
    } catch {
      setStatus(t("buddy.compose_video_too_big"));
    }
  }, [live, putCipher, t, video]);

  const onPickVideo = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const picked = await pickVideoUnderCap();
      if (!picked.ok) {
        setStatus(t(videoPickFailureI18nKey(picked.reason)));
        return;
      }
      setPhoto(null);
      setGif(null);
      setVoice(null);
      setVideo(picked.media);
      setStatus(t("buddy.compose_video_ready"));
    } finally {
      setBusy(false);
    }
  }, [t]);

  const onCaptureVideo = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const picked = await captureVideoUnderCap();
      if (!picked.ok) {
        setStatus(t(videoPickFailureI18nKey(picked.reason)));
        return;
      }
      setPhoto(null);
      setGif(null);
      setVoice(null);
      setVideo(picked.media);
      setStatus(t("buddy.compose_video_ready"));
    } finally {
      setBusy(false);
    }
  }, [t]);

  const uploadVoice = useCallback(async () => {
    if (!voice) {
      setStatus(t("buddy.compose_voice_needed"));
      return;
    }
    const caption = live.trim() || undefined;
    try {
      await putCipher(
        encodeNudgeEnvelope({
          v: 1,
          kind: "voice",
          atMs: Date.now(),
          durationMs: voice.durationMs,
          ...(caption ? { text: caption } : {}),
          media: voice.media,
        }),
      );
    } catch {
      setStatus(t("buddy.compose_voice_too_big"));
    }
  }, [live, putCipher, t, voice]);

  const onPickGif = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const media = await pickGifUnderCap();
      if (!media) {
        setStatus(t("buddy.compose_gif_cancel"));
        return;
      }
      setPhoto(null);
      setVoice(null);
      setVideo(null);
      setGif(media);
      setStatus(t("buddy.compose_gif_ready"));
    } finally {
      setBusy(false);
    }
  }, [t]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: statusBarTopInset(4) },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={onBack} style={styles.back} accessibilityRole="button">
        <Text style={styles.backLabel}>← {t("nav.back")}</Text>
      </Pressable>
      <Text style={styles.title}>{t("buddy.compose_title")}</Text>
      <Text style={styles.lead}>{t("buddy.compose_lead")}</Text>
      <Text style={styles.meta}>
        {t("buddy.compose_event", { id: pending.eventId.slice(0, 16) })}
      </Text>

      <Pressable
        style={[styles.btn, busy && styles.disabled]}
        disabled={busy}
        onPress={() => onDone()}
        accessibilityRole="button"
      >
        <Text style={styles.btnLabel}>{t("buddy.compose_ignore")}</Text>
      </Pressable>

      {defaultNudge.trim() ? (
        <Pressable
          style={[styles.btnPrimary, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void upload(defaultNudge)}
          accessibilityRole="button"
        >
          <Text style={styles.btnPrimaryLabel}>
            {t("buddy.compose_send_default")}
          </Text>
        </Pressable>
      ) : null}

      <Text style={styles.section}>{t("buddy.compose_staged")}</Text>
      <Text style={styles.meta}>{t("buddy.compose_staged_lead")}</Text>
      {staged.length === 0 ? (
        <Text style={styles.meta}>{t("buddy.compose_staged_empty")}</Text>
      ) : (
        staged.map((n) => (
          <StagedNudgeRow
            key={n.id}
            t={t}
            nudge={n}
            busy={busy}
            onSend={() => void uploadStaged(n)}
            onDelete={() => {
              void removeStagedNudge(n.id).then(setStaged);
            }}
          />
        ))
      )}

      <Text style={styles.section}>{t("buddy.compose_photo")}</Text>
      <Text style={styles.meta}>{t("buddy.compose_photo_lead")}</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void onPickPhoto()}
        >
          <Text style={styles.btnLabel}>{t("buddy.compose_photo_pick")}</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void onCapturePhoto()}
        >
          <Text style={styles.btnLabel}>{t("buddy.compose_photo_camera")}</Text>
        </Pressable>
        {photo ? (
          <Pressable
            style={[styles.btnPrimary, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void uploadPhoto()}
          >
            <Text style={styles.btnPrimaryLabel}>
              {t("buddy.compose_photo_send")}
            </Text>
          </Pressable>
        ) : null}
        {photo ? (
          <Pressable
            style={[styles.btn, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void savePhotoStaged()}
          >
            <Text style={styles.btnLabel}>{t("buddy.compose_save_staged")}</Text>
          </Pressable>
        ) : null}
      </View>
      {photo ? (
        <Image
          source={{ uri: `data:${photo.mime};base64,${photo.data}` }}
          style={styles.preview}
          accessibilityLabel={t("buddy.compose_photo")}
        />
      ) : null}

      <Text style={styles.section}>{t("buddy.compose_gif")}</Text>
      <Text style={styles.meta}>{t("buddy.compose_gif_lead")}</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void onPickGif()}
        >
          <Text style={styles.btnLabel}>{t("buddy.compose_gif_pick")}</Text>
        </Pressable>
        {gif ? (
          <Pressable
            style={[styles.btnPrimary, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void uploadGif()}
          >
            <Text style={styles.btnPrimaryLabel}>
              {t("buddy.compose_gif_send")}
            </Text>
          </Pressable>
        ) : null}
        {gif ? (
          <Pressable
            style={[styles.btn, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void saveGifStaged()}
          >
            <Text style={styles.btnLabel}>{t("buddy.compose_save_staged")}</Text>
          </Pressable>
        ) : null}
      </View>
      {gif ? (
        <Image
          source={{ uri: `data:${gif.mime};base64,${gif.data}` }}
          style={styles.preview}
          accessibilityLabel={t("buddy.compose_gif")}
        />
      ) : null}

      <Text style={styles.section}>{t("buddy.compose_voice")}</Text>
      <BuddyVoiceRecorder
        t={t}
        busy={busy}
        onStatus={setStatus}
        onReady={(media, durationMs) => {
          setPhoto(null);
          setGif(null);
          setVideo(null);
          setVoice({ media, durationMs });
        }}
      />
      {voice ? (
        <View style={styles.row}>
          <Pressable
            style={[styles.btnPrimary, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void uploadVoice()}
          >
            <Text style={styles.btnPrimaryLabel}>
              {t("buddy.compose_voice_send")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.btn, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void saveVoiceStaged()}
          >
            <Text style={styles.btnLabel}>{t("buddy.compose_save_staged")}</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.section}>{t("buddy.compose_video")}</Text>
      <Text style={styles.meta}>{t("buddy.compose_video_lead")}</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void onPickVideo()}
        >
          <Text style={styles.btnLabel}>{t("buddy.compose_video_pick")}</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void onCaptureVideo()}
        >
          <Text style={styles.btnLabel}>{t("buddy.compose_video_camera")}</Text>
        </Pressable>
        {video ? (
          <Pressable
            style={[styles.btnPrimary, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void uploadVideo()}
          >
            <Text style={styles.btnPrimaryLabel}>
              {t("buddy.compose_video_send")}
            </Text>
          </Pressable>
        ) : null}
        {video ? (
          <Pressable
            style={[styles.btn, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void saveVideoStaged()}
          >
            <Text style={styles.btnLabel}>{t("buddy.compose_save_staged")}</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.section}>{t("buddy.compose_presets")}</Text>
      <Text style={styles.meta}>{t("buddy.compose_presets_lead")}</Text>
      <View style={styles.row}>
        {SOUND_PRESET_IDS.map((id) => (
          <View key={id} style={styles.presetCol}>
            <Pressable
              style={[styles.btn, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void uploadPreset(id)}
              accessibilityRole="button"
            >
              <Text style={styles.btnLabel}>
                {t(SOUND_PRESET_I18N_KEYS[id])}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.btn, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void savePresetStaged(id)}
            >
              <Text style={styles.btnLabel}>{t("buddy.compose_save_staged")}</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Text style={styles.section}>{t("buddy.compose_live")}</Text>
      <TextInput
        style={styles.input}
        value={live}
        onChangeText={setLive}
        placeholder={t("buddy.compose_live_placeholder")}
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={280}
      />
      <View style={styles.row}>
        <Pressable
          style={[styles.btnPrimary, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void upload(live)}
        >
          <Text style={styles.btnPrimaryLabel}>{t("buddy.compose_send_live")}</Text>
        </Pressable>
        <Pressable
          style={styles.btn}
          disabled={busy}
          onPress={() => {
            void addStagedNudge(live).then(setStaged);
          }}
        >
          <Text style={styles.btnLabel}>{t("buddy.compose_save_staged")}</Text>
        </Pressable>
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 48,
    gap: 12,
  },
  back: { alignSelf: "flex-start", paddingVertical: 8 },
  backLabel: { fontSize: 15, fontWeight: "700", color: colors.teal },
  title: {
    fontSize: typography.titleSize,
    fontWeight: "800",
    color: colors.ink,
  },
  lead: {
    fontSize: typography.bodySize,
    lineHeight: 22,
    color: colors.textMuted,
  },
  meta: { fontSize: typography.metaSize, color: colors.textMuted },
  section: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  btn: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.chipOff,
  },
  btnLabel: { fontWeight: "700", color: colors.ink },
  btnPrimary: {
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.chipOn,
  },
  btnPrimaryLabel: { fontWeight: "700", color: colors.white },
  disabled: { opacity: 0.5 },
  stagedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  staged: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.chipOff,
    gap: 4,
  },
  stagedKind: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  stagedBody: { color: colors.ink, fontSize: 15, lineHeight: 20 },
  stagedDelete: { paddingVertical: 8, paddingHorizontal: 6 },
  stagedDeleteLabel: {
    fontWeight: "700",
    color: colors.ember,
    fontSize: 12,
  },
  presetCol: { gap: 6 },
  input: {
    minHeight: 88,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 15,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preview: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: colors.chipOff,
    resizeMode: "cover",
  },
  status: { fontSize: 14, color: colors.teal, fontWeight: "600" },
});
