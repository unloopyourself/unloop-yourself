import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppState,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
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
  encodeNudgeBlob,
  encodeStagedNudgeCipher,
  loadStagedNudges,
  type PendingApproach,
  type StagedNudge,
} from "../buddyNudgeStore";
import {
  pickGifUnderCap,
  recoverPendingCameraVideo,
  type VideoNudgeMedia,
} from "../buddyMediaEncode";
import { SOUND_PRESET_I18N_KEYS } from "../buddySoundPresets";
import {
  BUILTIN_EMOTICONS,
  BUILTIN_GIF_STICKERS,
  loadBuiltinGifMedia,
} from "../buddyBuiltinStickers";
import { BuddyVoiceRecorder } from "./BuddyVoiceRecorder";
import { BuddyVideoRecorder } from "./BuddyVideoRecorder";
import { StagedNudgeRow } from "./StagedNudgePreview";
import { HttpRelayPort } from "../push/httpRelayPort";
import { getRelayBaseUrl } from "../push/expoPushPort";
import { loadBuddies, shortFingerprint } from "../buddyStore";

type WizardKind = "text" | "react" | "audio" | "video";

type Props = {
  t: Translate;
  pending: PendingApproach;
  defaultNudge: string;
  /** Seeker nick / short label when known. */
  seekerLabel?: string;
  onDone: () => void;
  onBack: () => void;
};

export function BuddyComposeScreen({
  t,
  pending,
  defaultNudge,
  seekerLabel: seekerLabelProp,
  onDone,
  onBack,
}: Props) {
  const [kind, setKind] = useState<WizardKind | null>(null);
  const [staged, setStaged] = useState<StagedNudge[]>([]);
  const [live, setLive] = useState(defaultNudge.trim());
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seekerLabel, setSeekerLabel] = useState(seekerLabelProp ?? "");

  useEffect(() => {
    void loadStagedNudges().then(setStaged);
  }, []);

  useEffect(() => {
    if (seekerLabelProp) {
      setSeekerLabel(seekerLabelProp);
      return;
    }
    let alive = true;
    void loadBuddies().then((list) => {
      if (!alive) return;
      const match = list.find((b) => b.mailboxId === pending.mailboxId);
      const label =
        match?.displayLabel?.trim() ||
        (match?.pub ? shortFingerprint(match.pub) : "");
      if (label) setSeekerLabel(label);
    });
    return () => {
      alive = false;
    };
  }, [pending.mailboxId, seekerLabelProp]);

  const audioStaged = useMemo(
    () =>
      staged.filter((n) => n.kind === "voice" || n.kind === "sound_preset"),
    [staged],
  );
  const videoStaged = useMemo(
    () => staged.filter((n) => n.kind === "video"),
    [staged],
  );

  const finishAfterSend = useCallback(
    (offerSave?: () => Promise<void>) => {
      if (!offerSave) {
        setStatus(t("buddy.compose_sent"));
        onDone();
        return;
      }
      Alert.alert(
        t("buddy.compose_save_new_title"),
        t("buddy.compose_save_new_body"),
        [
          {
            text: t("buddy.compose_save_new_no"),
            style: "cancel",
            onPress: () => {
              setStatus(t("buddy.compose_sent"));
              onDone();
            },
          },
          {
            text: t("buddy.compose_save_new_yes"),
            onPress: () => {
              void (async () => {
                try {
                  await offerSave();
                } catch {
                  /* best-effort */
                }
                setStatus(t("buddy.compose_sent"));
                onDone();
              })();
            },
          },
        ],
      );
    },
    [onDone, t],
  );

  const putCipher = useCallback(
    async (
      ciphertext: string,
      opts?: { offerSave?: () => Promise<void> },
    ) => {
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
        try {
          await Notifications.dismissAllNotificationsAsync();
        } catch {
          /* tray optional */
        }
        finishAfterSend(opts?.offerSave);
      } catch {
        setStatus(t("buddy.compose_fail"));
      } finally {
        setBusy(false);
      }
    },
    [finishAfterSend, pending.eventId, pending.mailboxId, t],
  );

  const uploadText = useCallback(
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

  const uploadPreset = useCallback(
    async (presetId: SoundPresetId) => {
      await putCipher(
        encodeNudgeEnvelope(soundPresetNudgeEnvelope(presetId)),
      );
    },
    [putCipher],
  );

  const uploadGifMedia = useCallback(
    async (media: NudgeMediaInline) => {
      try {
        await putCipher(
          encodeNudgeEnvelope({
            v: 1,
            kind: "gif",
            atMs: Date.now(),
            media,
          }),
        );
      } catch {
        setStatus(t("buddy.compose_gif_too_big"));
      }
    },
    [putCipher, t],
  );

  const sendVoiceMedia = useCallback(
    async (media: NudgeMediaInline, durationMs: number) => {
      try {
        await putCipher(
          encodeNudgeEnvelope({
            v: 1,
            kind: "voice",
            atMs: Date.now(),
            durationMs,
            media,
          }),
          {
            offerSave: async () => {
              const next = await addStagedMedia({
                kind: "voice",
                media,
                durationMs,
              });
              setStaged(next);
            },
          },
        );
      } catch {
        setStatus(t("buddy.compose_voice_too_big"));
      }
    },
    [putCipher, t],
  );

  const sendVideoMedia = useCallback(
    async (media: VideoNudgeMedia) => {
      try {
        await putCipher(
          encodeNudgeEnvelope({
            v: 1,
            kind: "video",
            atMs: Date.now(),
            durationMs: media.durationMs,
            media: {
              encoding: media.encoding,
              mime: media.mime,
              byteLength: media.byteLength,
              data: media.data,
            },
          }),
          {
            offerSave: async () => {
              const next = await addStagedMedia({
                kind: "video",
                media: {
                  encoding: media.encoding,
                  mime: media.mime,
                  byteLength: media.byteLength,
                  data: media.data,
                },
                durationMs: media.durationMs,
              });
              setStaged(next);
            },
          },
        );
      } catch {
        setStatus(t("buddy.compose_video_too_big"));
      }
    },
    [putCipher, t],
  );

  useEffect(() => {
    let alive = true;
    const reclaim = async () => {
      const recovered = await recoverPendingCameraVideo();
      if (!alive || !recovered) return;
      if (recovered.intent.mode === "compose") {
        setKind("video");
        await sendVideoMedia(recovered.media);
        return;
      }
      setStaged(await loadStagedNudges());
    };
    void reclaim();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void reclaim();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [sendVideoMedia]);

  const onPickGif = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const media = await pickGifUnderCap();
      if (!media) {
        setStatus(t("buddy.compose_gif_cancel"));
        return;
      }
      await uploadGifMedia(media);
    } finally {
      setBusy(false);
    }
  }, [t, uploadGifMedia]);

  const onBuiltinGif = useCallback(
    async (moduleId: number) => {
      setBusy(true);
      setStatus(null);
      try {
        const media = await loadBuiltinGifMedia(moduleId);
        if (!media) {
          setStatus(t("buddy.compose_fail"));
          return;
        }
        await uploadGifMedia(media);
      } finally {
        setBusy(false);
      }
    },
    [t, uploadGifMedia],
  );

  const name = seekerLabel.trim() || t("buddy.compose_seeker_fallback");

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
      <Text style={styles.lead}>
        {t("buddy.compose_wizard_lead", { name })}
      </Text>

      <View style={styles.kindGrid}>
        {(
          [
            ["text", "buddy.compose_kind_text"],
            ["react", "buddy.compose_kind_react"],
            ["audio", "buddy.compose_kind_audio"],
            ["video", "buddy.compose_kind_video"],
          ] as const
        ).map(([id, key]) => {
          const on = kind === id;
          return (
            <Pressable
              key={id}
              style={[styles.kindBtn, on && styles.kindBtnOn]}
              disabled={busy}
              onPress={() => {
                setKind(id);
                setStatus(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.kindBtnLabel, on && styles.kindBtnLabelOn]}>
                {t(key)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {kind === "text" ? (
        <View style={styles.panel}>
          <TextInput
            style={styles.input}
            value={live}
            onChangeText={setLive}
            placeholder={t("buddy.compose_live_placeholder")}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={280}
            autoFocus
          />
          <Pressable
            style={[styles.btnPrimary, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void uploadText(live)}
          >
            <Text style={styles.btnPrimaryLabel}>
              {t("buddy.compose_send_live")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {kind === "react" ? (
        <View style={styles.panel}>
          <Text style={styles.panelLabel}>{t("buddy.compose_react_gif")}</Text>
          <View style={styles.stickerGrid}>
            {BUILTIN_GIF_STICKERS.map((s) => (
              <Pressable
                key={s.id}
                style={[styles.stickerCell, busy && styles.disabled]}
                disabled={busy}
                onPress={() => void onBuiltinGif(s.module)}
                accessibilityRole="button"
                accessibilityLabel={t(s.labelKey)}
              >
                <Image
                  source={s.module}
                  style={styles.stickerImg}
                  accessibilityIgnoresInvertColors
                />
                <Text style={styles.stickerCap}>{t(s.labelKey)}</Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.stickerCell, styles.addCell, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void onPickGif()}
              accessibilityRole="button"
            >
              <Text style={styles.addPlus}>+</Text>
              <Text style={styles.stickerCap}>{t("buddy.compose_react_add")}</Text>
            </Pressable>
          </View>

          <Text style={styles.panelLabel}>
            {t("buddy.compose_react_emoticon")}
          </Text>
          <View style={styles.emojiRow}>
            {BUILTIN_EMOTICONS.map((e) => (
              <Pressable
                key={e.id}
                style={[styles.emojiBtn, busy && styles.disabled]}
                disabled={busy}
                onPress={() => void uploadText(e.emoji)}
                accessibilityRole="button"
                accessibilityLabel={e.emoji}
              >
                <Text style={styles.emoji}>{e.emoji}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {kind === "audio" ? (
        <View style={styles.panel}>
          <Text style={styles.panelLabel}>{t("buddy.compose_audio_presets")}</Text>
          <View style={styles.row}>
            {SOUND_PRESET_IDS.map((id) => (
              <Pressable
                key={id}
                style={[styles.chip, busy && styles.disabled]}
                disabled={busy}
                onPress={() => void uploadPreset(id)}
              >
                <Text style={styles.chipLabel}>
                  {t(SOUND_PRESET_I18N_KEYS[id])}
                </Text>
              </Pressable>
            ))}
          </View>

          {audioStaged.length > 0 ? (
            <>
              <Text style={styles.panelLabel}>
                {t("buddy.compose_audio_saved")}
              </Text>
              {audioStaged.map((n) => (
                <StagedNudgeRow
                  key={n.id}
                  t={t}
                  nudge={n}
                  busy={busy}
                  onSend={() => void uploadStaged(n)}
                />
              ))}
            </>
          ) : null}

          <Text style={styles.panelLabel}>{t("buddy.compose_audio_record")}</Text>
          <BuddyVoiceRecorder
            t={t}
            busy={busy}
            onInk
            onStatus={setStatus}
            onReady={(media, durationMs) => {
              void sendVoiceMedia(media, durationMs);
            }}
          />
        </View>
      ) : null}

      {kind === "video" ? (
        <View style={styles.panel}>
          {videoStaged.length > 0 ? (
            <>
              <Text style={styles.panelLabel}>
                {t("buddy.compose_video_saved")}
              </Text>
              {videoStaged.map((n) => (
                <StagedNudgeRow
                  key={n.id}
                  t={t}
                  nudge={n}
                  busy={busy}
                  onSend={() => void uploadStaged(n)}
                />
              ))}
            </>
          ) : (
            <Text style={styles.meta}>{t("buddy.compose_video_saved_empty")}</Text>
          )}

          <Text style={styles.panelLabel}>{t("buddy.compose_video_record")}</Text>
          <BuddyVideoRecorder
            t={t}
            busy={busy}
            onStatus={setStatus}
            onReady={(media) => {
              void sendVideoMedia(media);
            }}
          />
        </View>
      ) : null}

      <Pressable
        style={[styles.btnGhost, busy && styles.disabled]}
        disabled={busy}
        onPress={() => onDone()}
        accessibilityRole="button"
      >
        <Text style={styles.btnGhostLabel}>{t("buddy.compose_ignore")}</Text>
      </Pressable>

      {status ? <Text style={styles.status}>{status}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 14,
  },
  back: { alignSelf: "flex-start", paddingVertical: 8 },
  backLabel: { fontSize: 15, fontWeight: "700", color: colors.teal },
  title: {
    fontSize: typography.titleSize,
    fontWeight: "800",
    color: colors.textOnInk,
  },
  lead: {
    fontSize: typography.bodySize,
    lineHeight: 22,
    color: "rgba(242,245,248,0.78)",
  },
  meta: {
    fontSize: typography.metaSize,
    color: "rgba(242,245,248,0.65)",
  },
  kindGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kindBtn: {
    minWidth: "47%",
    flexGrow: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  kindBtnOn: {
    backgroundColor: colors.ember,
    borderColor: colors.ember,
  },
  kindBtnLabel: {
    textAlign: "center",
    fontWeight: "800",
    fontSize: 15,
    color: colors.textOnInk,
    letterSpacing: 0.3,
  },
  kindBtnLabelOn: { color: colors.white },
  panel: {
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  panelLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(242,245,248,0.55)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    minHeight: 96,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 15,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.chipOff,
  },
  chipLabel: { fontWeight: "700", color: colors.ink, fontSize: 13 },
  stickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  stickerCell: {
    width: "30%",
    flexGrow: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  addCell: {
    justifyContent: "center",
    minHeight: 88,
  },
  stickerImg: { width: 56, height: 56 },
  stickerCap: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(242,245,248,0.7)",
  },
  addPlus: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.teal,
    lineHeight: 32,
  },
  emojiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  emojiBtn: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  emoji: { fontSize: 28 },
  btnPrimary: {
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.ember,
  },
  btnPrimaryLabel: { fontWeight: "700", color: colors.white },
  btnGhost: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  btnGhostLabel: {
    fontWeight: "700",
    color: "rgba(242,245,248,0.55)",
    fontSize: 14,
  },
  disabled: { opacity: 0.5 },
  status: { fontSize: 14, color: colors.teal, fontWeight: "600" },
});
