import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import type { BuddyRecord } from "@unloop/core";
import { SOUND_PRESET_IDS } from "@unloop/core";
import type { Translate } from "../i18n";
import { colors, typography } from "../theme";
import { statusBarTopInset } from "../layout";
import {
  acceptInviteLink,
  buildMyInvite,
  loadBuddies,
  revokeBuddy,
  shortFingerprint,
} from "../buddyStore";
import {
  addStagedMedia,
  addStagedNudge,
  addStagedPreset,
  loadStagedNudges,
  removeStagedNudge,
  stagedNudgeSummary,
  type StagedNudge,
} from "../buddyNudgeStore";
import {
  captureCompressedPhoto,
  captureVideoUnderCap,
  pickCompressedPhoto,
  pickGifUnderCap,
  pickVideoUnderCap,
} from "../buddyMediaEncode";
import { SOUND_PRESET_I18N_KEYS } from "../buddySoundPresets";
import { BuddyVoiceRecorder } from "./BuddyVoiceRecorder";

type Props = {
  t: Translate;
  onBack: () => void;
  /** Deep-link payload to accept once on mount (optional). */
  pendingInvite?: string | null;
  onPendingInviteConsumed?: () => void;
};

export function BuddyScreen({
  t,
  onBack,
  pendingInvite,
  onPendingInviteConsumed,
}: Props) {
  const [link, setLink] = useState<string>("");
  const [myFp, setMyFp] = useState<string>("");
  const [buddies, setBuddies] = useState<BuddyRecord[]>([]);
  const [staged, setStaged] = useState<StagedNudge[]>([]);
  const [paste, setPaste] = useState("");
  const [stageText, setStageText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [{ link: inviteLink, invite }, list, stagedList] = await Promise.all([
      buildMyInvite("seeker"),
      loadBuddies(),
      loadStagedNudges(),
    ]);
    setLink(inviteLink);
    setMyFp(shortFingerprint(invite.pub));
    setBuddies(list);
    setStaged(stagedList);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveStagedText = useCallback(async () => {
    const next = await addStagedNudge(stageText);
    setStaged(next);
    setStageText("");
    setStatus(t("buddy.compose_staged_saved"));
  }, [stageText, t]);

  const stagePhoto = useCallback(async (fromCamera: boolean) => {
    setBusy(true);
    setStatus(null);
    try {
      const media = fromCamera
        ? await captureCompressedPhoto()
        : await pickCompressedPhoto();
      if (!media) {
        setStatus(t("buddy.compose_photo_cancel"));
        return;
      }
      setStaged(
        await addStagedMedia({
          kind: "photo",
          media,
          caption: stageText.trim() || undefined,
        }),
      );
      setStatus(t("buddy.compose_staged_saved"));
    } finally {
      setBusy(false);
    }
  }, [stageText, t]);

  const stageGif = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const media = await pickGifUnderCap();
      if (!media) {
        setStatus(t("buddy.compose_gif_cancel"));
        return;
      }
      setStaged(
        await addStagedMedia({
          kind: "gif",
          media,
          caption: stageText.trim() || undefined,
        }),
      );
      setStatus(t("buddy.compose_staged_saved"));
    } finally {
      setBusy(false);
    }
  }, [stageText, t]);

  const stageVideo = useCallback(async (fromCamera: boolean) => {
    setBusy(true);
    setStatus(null);
    try {
      const media = fromCamera
        ? await captureVideoUnderCap()
        : await pickVideoUnderCap();
      if (!media) {
        setStatus(t("buddy.compose_video_cancel"));
        return;
      }
      setStaged(
        await addStagedMedia({
          kind: "video",
          media: {
            encoding: media.encoding,
            mime: media.mime,
            byteLength: media.byteLength,
            data: media.data,
          },
          durationMs: media.durationMs,
          caption: stageText.trim() || undefined,
        }),
      );
      setStatus(t("buddy.compose_staged_saved"));
    } finally {
      setBusy(false);
    }
  }, [stageText, t]);

  const applyInvite = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      setBusy(true);
      try {
        const result = await acceptInviteLink(trimmed);
        if (!result.ok) {
          setStatus(t(`buddy.accept_${result.reason}`));
          return;
        }
        const fp = shortFingerprint(result.buddy.pub);
        setStatus(
          t(result.alreadyPaired ? "buddy.accept_already" : "buddy.accept_ok", {
            fp,
          }),
        );
        setPaste("");
        setBuddies(await loadBuddies());
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!pendingInvite) return;
    void (async () => {
      await applyInvite(pendingInvite);
      onPendingInviteConsumed?.();
    })();
  }, [pendingInvite, applyInvite, onPendingInviteConsumed]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: statusBarTopInset(4) },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={onBack}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel={t("nav.back")}
      >
        <Text style={styles.backLabel}>← {t("nav.back")}</Text>
      </Pressable>

      <Text style={styles.title}>{t("buddy.title")}</Text>
      <Text style={styles.lead}>{t("buddy.lead")}</Text>

      <Text style={styles.section}>{t("buddy.your_invite")}</Text>
      <Text style={styles.meta}>{t("buddy.fingerprint", { fp: myFp || "…" })}</Text>
      <Text style={styles.hint}>{t("buddy.scan_hint")}</Text>

      {link ? (
        <View style={styles.qrWrap} accessibilityLabel="Buddy invite QR code">
          <QRCode value={link} size={200} backgroundColor={colors.white} color={colors.ink} />
        </View>
      ) : null}

      <View style={styles.row}>
        <Pressable
          style={styles.btn}
          onPress={() => {
            void Clipboard.setStringAsync(link).then(() =>
              setStatus(t("buddy.copied")),
            );
          }}
          accessibilityRole="button"
        >
          <Text style={styles.btnLabel}>{t("buddy.copy_link")}</Text>
        </Pressable>
        <Pressable
          style={styles.btn}
          onPress={() => {
            void Share.share({ message: link });
          }}
          accessibilityRole="button"
        >
          <Text style={styles.btnLabel}>{t("buddy.share_link")}</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>{t("buddy.paste_label")}</Text>
      <TextInput
        style={styles.input}
        value={paste}
        onChangeText={setPaste}
        placeholder={t("buddy.paste_placeholder")}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      <Pressable
        style={[styles.btnPrimary, busy && styles.btnDisabled]}
        disabled={busy}
        onPress={() => void applyInvite(paste)}
        accessibilityRole="button"
      >
        <Text style={styles.btnPrimaryLabel}>{t("buddy.accept")}</Text>
      </Pressable>

      {status ? <Text style={styles.status}>{status}</Text> : null}

      <Text style={styles.section}>{t("buddy.paired_list")}</Text>
      {buddies.length === 0 ? (
        <Text style={styles.meta}>{t("buddy.empty")}</Text>
      ) : (
        buddies.map((b) => (
          <View key={b.buddyId} style={styles.buddyRow}>
            <View style={styles.buddyMain}>
              <Text style={styles.buddyTitle}>
                {b.displayLabel ?? shortFingerprint(b.pub)}
              </Text>
              <Text style={styles.meta}>
                {b.role === "buddy" ? t("buddy.role_buddy") : t("buddy.role_seeker")}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                void revokeBuddy(b.buddyId).then(setBuddies);
              }}
              style={styles.revoke}
              accessibilityRole="button"
            >
              <Text style={styles.revokeLabel}>{t("buddy.revoke")}</Text>
            </Pressable>
          </View>
        ))
      )}

      <Text style={styles.section}>{t("buddy.prepare_title")}</Text>
      <Text style={styles.meta}>{t("buddy.prepare_lead")}</Text>
      <TextInput
        style={styles.input}
        value={stageText}
        onChangeText={setStageText}
        placeholder={t("buddy.prepare_caption_placeholder")}
        placeholderTextColor={colors.textMuted}
        multiline
      />
      <View style={styles.row}>
        <Pressable
          style={[styles.btnPrimary, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => void saveStagedText()}
        >
          <Text style={styles.btnPrimaryLabel}>{t("buddy.prepare_save_text")}</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => void stagePhoto(false)}
        >
          <Text style={styles.btnLabel}>{t("buddy.compose_photo_pick")}</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => void stagePhoto(true)}
        >
          <Text style={styles.btnLabel}>{t("buddy.compose_photo_camera")}</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => void stageGif()}
        >
          <Text style={styles.btnLabel}>{t("buddy.compose_gif_pick")}</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => void stageVideo(false)}
        >
          <Text style={styles.btnLabel}>{t("buddy.compose_video_pick")}</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => void stageVideo(true)}
        >
          <Text style={styles.btnLabel}>{t("buddy.compose_video_camera")}</Text>
        </Pressable>
      </View>
      <BuddyVoiceRecorder
        t={t}
        busy={busy}
        onStatus={setStatus}
        onReady={(media, durationMs) => {
          void addStagedMedia({
            kind: "voice",
            media,
            durationMs,
            caption: stageText.trim() || undefined,
          }).then((next) => {
            setStaged(next);
            setStatus(t("buddy.compose_staged_saved"));
          });
        }}
      />
      <View style={styles.row}>
        {SOUND_PRESET_IDS.map((id) => (
          <Pressable
            key={id}
            style={[styles.btn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => {
              void addStagedPreset(id, stageText.trim() || undefined).then(
                (next) => {
                  setStaged(next);
                  setStatus(t("buddy.compose_staged_saved"));
                },
              );
            }}
          >
            <Text style={styles.btnLabel}>{t(SOUND_PRESET_I18N_KEYS[id])}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>{t("buddy.compose_staged")}</Text>
      {staged.length === 0 ? (
        <Text style={styles.meta}>{t("buddy.compose_staged_empty")}</Text>
      ) : (
        staged.map((n) => (
          <View key={n.id} style={styles.buddyRow}>
            <View style={styles.buddyMain}>
              <Text style={styles.buddyTitle}>{t(`buddy.kind_${n.kind}`)}</Text>
              <Text style={styles.meta} numberOfLines={2}>
                {stagedNudgeSummary(n)}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                void removeStagedNudge(n.id).then(setStaged);
              }}
              style={styles.revoke}
              accessibilityRole="button"
            >
              <Text style={styles.revokeLabel}>
                {t("buddy.compose_staged_delete")}
              </Text>
            </Pressable>
          </View>
        ))
      )}
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
  section: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  meta: { fontSize: typography.metaSize, color: colors.textMuted },
  hint: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  qrWrap: {
    alignSelf: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: {
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
  btnDisabled: { opacity: 0.5 },
  input: {
    minHeight: 72,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 14,
    textAlignVertical: "top",
  },
  status: { fontSize: 14, color: colors.teal, fontWeight: "600" },
  buddyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.chipOff,
  },
  buddyMain: { flex: 1, gap: 2 },
  buddyTitle: { fontWeight: "700", color: colors.ink, fontSize: 15 },
  revoke: { paddingVertical: 8, paddingHorizontal: 10 },
  revokeLabel: { fontWeight: "700", color: colors.ember, fontSize: 13 },
});
