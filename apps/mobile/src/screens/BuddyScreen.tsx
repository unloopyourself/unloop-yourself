import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
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
  updateBuddyPrefs,
} from "../buddyStore";
import { syncBuddyApproachingNative } from "../buddyApproachingNative";
import { loadSettings } from "../settings";
import {
  addStagedMedia,
  addStagedNudge,
  addStagedPreset,
  loadStagedNudges,
  removeStagedNudge,
  type StagedNudge,
} from "../buddyNudgeStore";
import {
  captureCompressedPhoto,
  captureVideoUnderCap,
  pickCompressedPhoto,
  pickGifUnderCap,
  pickVideoUnderCap,
  recoverPendingCameraVideo,
  videoPickFailureI18nKey,
} from "../buddyMediaEncode";
import { SOUND_PRESET_I18N_KEYS } from "../buddySoundPresets";
import { BuddyVoiceRecorder } from "./BuddyVoiceRecorder";
import { BuddyVideoRecorder } from "./BuddyVideoRecorder";
import { StagedNudgeRow } from "./StagedNudgePreview";
import {
  CollapsibleSection,
  MIN_TOUCH,
  Section,
  ToggleRow,
} from "./SectionKit";

type StatusScope = "invite" | "pair" | "prepare" | "staged";

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
  /** Status is scoped so feedback renders next to the action that produced it. */
  const [statusNote, setStatusNote] = useState<{
    scope: StatusScope;
    text: string;
  } | null>(null);
  const setStatus = useCallback(
    (scope: StatusScope, text: string | null) =>
      setStatusNote(text ? { scope, text } : null),
    [],
  );
  const statusFor = (...scopes: StatusScope[]) =>
    statusNote && scopes.includes(statusNote.scope) ? statusNote.text : null;
  const [busy, setBusy] = useState(false);
  // Session-only disclosure state. Prepare tools are open only while the
  // saved library is empty (decided once, after the first load).
  const [pairingOpen, setPairingOpen] = useState(true);
  const [prepareOpen, setPrepareOpen] = useState(false);
  const disclosureInit = useRef(false);

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
    if (!disclosureInit.current) {
      disclosureInit.current = true;
      setPrepareOpen(stagedList.length === 0);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Reclaim video after Android kills MainActivity during OEM camera. */
  useEffect(() => {
    let alive = true;
    const reclaim = async () => {
      const recovered = await recoverPendingCameraVideo();
      if (!alive || !recovered) return;
      // Compose draft is owned by BuddyComposeScreen; stage here as safe landing.
      const next = await addStagedMedia({
        kind: "video",
        media: {
          encoding: recovered.media.encoding,
          mime: recovered.media.mime,
          byteLength: recovered.media.byteLength,
          data: recovered.media.data,
        },
        durationMs: recovered.media.durationMs,
        caption: recovered.intent.caption,
      });
      if (!alive) return;
      setStaged(next);
      setStatus("staged", t("buddy.compose_staged_saved"));
    };
    void reclaim();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void reclaim();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [t]);

  const saveStagedText = useCallback(async () => {
    const next = await addStagedNudge(stageText);
    setStaged(next);
    setStageText("");
    setStatus("prepare", t("buddy.compose_staged_saved"));
  }, [stageText, t]);

  const stagePhoto = useCallback(async (fromCamera: boolean) => {
    setBusy(true);
    setStatus("prepare", null);
    try {
      const media = fromCamera
        ? await captureCompressedPhoto()
        : await pickCompressedPhoto();
      if (!media) {
        setStatus("prepare", t("buddy.compose_photo_cancel"));
        return;
      }
      setStaged(
        await addStagedMedia({
          kind: "photo",
          media,
          caption: stageText.trim() || undefined,
        }),
      );
      setStatus("prepare", t("buddy.compose_staged_saved"));
    } finally {
      setBusy(false);
    }
  }, [stageText, t]);

  const stageGif = useCallback(async () => {
    setBusy(true);
    setStatus("prepare", null);
    try {
      const media = await pickGifUnderCap();
      if (!media) {
        setStatus("prepare", t("buddy.compose_gif_cancel"));
        return;
      }
      setStaged(
        await addStagedMedia({
          kind: "gif",
          media,
          caption: stageText.trim() || undefined,
        }),
      );
      setStatus("prepare", t("buddy.compose_staged_saved"));
    } finally {
      setBusy(false);
    }
  }, [stageText, t]);

  const stageVideo = useCallback(async (fromCamera: boolean) => {
    setBusy(true);
    setStatus("prepare", null);
    try {
      const caption = stageText.trim() || undefined;
      const picked = fromCamera
        ? await captureVideoUnderCap({ mode: "stage", caption })
        : await pickVideoUnderCap();
      if (!picked.ok) {
        setStatus("prepare", t(videoPickFailureI18nKey(picked.reason)));
        return;
      }
      setStaged(
        await addStagedMedia({
          kind: "video",
          media: {
            encoding: picked.media.encoding,
            mime: picked.media.mime,
            byteLength: picked.media.byteLength,
            data: picked.media.data,
          },
          durationMs: picked.media.durationMs,
          caption,
        }),
      );
      setStatus("prepare", t("buddy.compose_staged_saved"));
    } catch {
      setStatus("prepare", t("buddy.compose_video_cancel"));
    } finally {
      setBusy(false);
    }
  }, [stageText, t]);

  const applyInvite = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      setBusy(true);
      // Result text renders inside Pairing; make sure it is visible.
      setPairingOpen(true);
      try {
        const result = await acceptInviteLink(trimmed);
        if (!result.ok) {
          setStatus("pair", t(`buddy.accept_${result.reason}`));
          return;
        }
        const fp = shortFingerprint(result.buddy.pub);
        setStatus("pair", 
          t(result.alreadyPaired ? "buddy.accept_already" : "buddy.accept_ok", {
            fp,
          }),
        );
        setPaste("");
        setBuddies(await loadBuddies());
        void syncBuddyApproachingNative(await loadSettings());
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

  const setPrepareStatus = useCallback(
    (msg: string | null) => setStatus("prepare", msg),
    [setStatus],
  );
  const collapseHint = (open: boolean) =>
    t(open ? "section.collapse_hint" : "section.expand_hint");
  const mediaCaption = stageText.trim() || undefined;

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

      {/* 1. Pairing: open by default; invite + paste live together. */}
      <CollapsibleSection
        title={t("buddy.pairing_section")}
        hint={collapseHint(pairingOpen)}
        expanded={pairingOpen}
        onToggle={() => setPairingOpen((v) => !v)}
      >
        <View style={styles.block}>
          <Text style={styles.subhead}>{t("buddy.your_invite")}</Text>
          <Text style={styles.meta}>
            {t("buddy.fingerprint", { fp: myFp || "…" })}
          </Text>
          {link ? (
            <View
              style={styles.qrWrap}
              accessibilityLabel="Buddy invite QR code"
            >
              <QRCode
                value={link}
                size={200}
                backgroundColor={colors.white}
                color={colors.ink}
              />
            </View>
          ) : null}
          <Text style={styles.hint}>{t("buddy.scan_hint")}</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnGrow]}
              onPress={() => {
                void Clipboard.setStringAsync(link).then(() =>
                  setStatus("invite", t("buddy.copied")),
                );
              }}
              accessibilityRole="button"
            >
              <Text style={styles.btnLabel}>{t("buddy.copy_link")}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnGrow]}
              onPress={() => {
                void Share.share({ message: link });
              }}
              accessibilityRole="button"
            >
              <Text style={styles.btnLabel}>{t("buddy.share_link")}</Text>
            </Pressable>
          </View>
          <StatusLine text={statusFor("invite")} />
        </View>

        <View style={styles.block}>
          <Text style={styles.subhead}>{t("buddy.paste_label")}</Text>
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
          <StatusLine text={statusFor("pair")} />
        </View>
      </CollapsibleSection>

      {/* 2. Buddies list: always visible. Seeker prefs per buddy (privacy). */}
      <Section
        title={t("buddy.paired_count", { n: buddies.length })}
        subtitle={t("buddy.paired_prefs_lead")}
      >
        {buddies.length === 0 ? (
          <Text style={styles.meta}>{t("buddy.empty")}</Text>
        ) : (
          <View style={styles.buddyList}>
            {buddies.map((b) => (
              <View key={b.buddyId} style={styles.buddyCard}>
                <View style={styles.buddyRow}>
                  <View style={styles.buddyMain}>
                    <Text style={styles.buddyTitle}>
                      {b.displayLabel ?? shortFingerprint(b.pub)}
                    </Text>
                    <Text style={styles.meta}>
                      {b.role === "buddy"
                        ? t("buddy.role_buddy")
                        : t("buddy.role_seeker")}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      void revokeBuddy(b.buddyId).then(async (list) => {
                        setBuddies(list);
                        void syncBuddyApproachingNative(await loadSettings());
                      });
                    }}
                    style={styles.revoke}
                    accessibilityRole="button"
                  >
                    <Text style={styles.revokeLabel}>{t("buddy.revoke")}</Text>
                  </Pressable>
                </View>
                <ToggleRow
                  label={t("buddy.notify_approaching")}
                  description={t("buddy.notify_approaching_lead")}
                  value={b.notifyApproaching === true}
                  onValueChange={(next) => {
                    void updateBuddyPrefs(b.buddyId, {
                      notifyApproaching: next,
                    }).then(async (list) => {
                      setBuddies(list);
                      void syncBuddyApproachingNative(await loadSettings());
                    });
                  }}
                />
                <ToggleRow
                  label={t("buddy.accept_nudges")}
                  description={t("buddy.accept_nudges_lead")}
                  value={b.acceptNudges !== false}
                  onValueChange={(next) => {
                    void updateBuddyPrefs(b.buddyId, {
                      acceptNudges: next,
                    }).then(async (list) => {
                      setBuddies(list);
                      void syncBuddyApproachingNative(await loadSettings());
                    });
                  }}
                />
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* 3. Staged library: the nudges ready to send. */}
      <Section
        title={t("buddy.compose_staged")}
        subtitle={t("buddy.staged_library_lead")}
      >
        {staged.length === 0 ? (
          <Text style={styles.meta}>{t("buddy.compose_staged_empty")}</Text>
        ) : (
          staged.map((n) => (
            <StagedNudgeRow
              key={n.id}
              t={t}
              nudge={n}
              busy={busy}
              onDelete={() => {
                void removeStagedNudge(n.id).then(setStaged);
              }}
            />
          ))
        )}
        <StatusLine text={statusFor("staged")} />
      </Section>

      {/* 4. Prepare tools: open while the library is empty, else one tap away. */}
      <CollapsibleSection
        title={t("buddy.prepare_title")}
        summary={t("buddy.prepare_summary")}
        hint={collapseHint(prepareOpen)}
        expanded={prepareOpen}
        onToggle={() => setPrepareOpen((v) => !v)}
      >
        <Text style={styles.hint}>{t("buddy.prepare_lead")}</Text>

        <View style={styles.block}>
          <Text style={styles.subhead}>{t("buddy.prepare_text_group")}</Text>
          <TextInput
            style={styles.input}
            value={stageText}
            onChangeText={setStageText}
            placeholder={t("buddy.prepare_caption_placeholder")}
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <Pressable
            style={[styles.btnPrimary, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void saveStagedText()}
            accessibilityRole="button"
          >
            <Text style={styles.btnPrimaryLabel}>
              {t("buddy.prepare_save_text")}
            </Text>
          </Pressable>
        </View>

        <View style={styles.block}>
          <Text style={styles.subhead}>{t("buddy.compose_photo")}</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnGrow, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => void stagePhoto(false)}
              accessibilityRole="button"
            >
              <Text style={styles.btnLabel}>
                {t("buddy.compose_photo_pick")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnGrow, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => void stagePhoto(true)}
              accessibilityRole="button"
            >
              <Text style={styles.btnLabel}>
                {t("buddy.compose_photo_camera")}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.subhead}>{t("buddy.compose_gif")}</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnGrow, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => void stageGif()}
              accessibilityRole="button"
            >
              <Text style={styles.btnLabel}>{t("buddy.compose_gif_pick")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.subhead}>{t("buddy.compose_video")}</Text>
          <Text style={styles.meta}>{t("buddy.compose_video_lead")}</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnGrow, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => void stageVideo(false)}
              accessibilityRole="button"
            >
              <Text style={styles.btnLabel}>
                {t("buddy.compose_video_pick")}
              </Text>
            </Pressable>
          </View>
          <BuddyVideoRecorder
            t={t}
            busy={busy}
            onStatus={setPrepareStatus}
            onReady={(media) => {
              void addStagedMedia({
                kind: "video",
                media: {
                  encoding: media.encoding,
                  mime: media.mime,
                  byteLength: media.byteLength,
                  data: media.data,
                },
                durationMs: media.durationMs,
                caption: mediaCaption,
              }).then((next) => {
                setStaged(next);
                setStatus("prepare", t("buddy.compose_staged_saved"));
              });
            }}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.subhead}>{t("buddy.compose_voice")}</Text>
          <BuddyVoiceRecorder
            t={t}
            busy={busy}
            onStatus={setPrepareStatus}
            onReady={(media, durationMs) => {
              void addStagedMedia({
                kind: "voice",
                media,
                durationMs,
                caption: mediaCaption,
              }).then((next) => {
                setStaged(next);
                setStatus("prepare", t("buddy.compose_staged_saved"));
              });
            }}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.subhead}>{t("buddy.prepare_sounds")}</Text>
          <View style={styles.row}>
            {SOUND_PRESET_IDS.map((id) => (
              <Pressable
                key={id}
                style={[styles.btn, busy && styles.btnDisabled]}
                disabled={busy}
                onPress={() => {
                  void addStagedPreset(id, mediaCaption).then((next) => {
                    setStaged(next);
                    setStatus("prepare", t("buddy.compose_staged_saved"));
                  });
                }}
                accessibilityRole="button"
              >
                <Text style={styles.btnLabel}>
                  {t(SOUND_PRESET_I18N_KEYS[id])}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <StatusLine text={statusFor("prepare")} />
      </CollapsibleSection>
    </ScrollView>
  );
}

/** Inline feedback; announced politely by screen readers. */
function StatusLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <Text style={styles.status} accessibilityLiveRegion="polite">
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 48,
    gap: 10,
  },
  back: {
    alignSelf: "flex-start",
    minHeight: MIN_TOUCH,
    justifyContent: "center",
  },
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
    marginBottom: 6,
  },
  /** One task cluster inside a section (label + controls). */
  block: { gap: 10 },
  subhead: { fontSize: 15, fontWeight: "700", color: colors.ink },
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
    minHeight: MIN_TOUCH,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.chipOff,
  },
  btnGrow: { flexGrow: 1, flexBasis: 140 },
  btnLabel: { fontWeight: "700", color: colors.ink },
  btnPrimary: {
    alignSelf: "flex-start",
    minHeight: MIN_TOUCH,
    justifyContent: "center",
    paddingHorizontal: 20,
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
  buddyList: { gap: 16 },
  buddyCard: {
    gap: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(10,37,64,0.12)",
  },
  buddyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingVertical: 4,
  },
  buddyMain: { flex: 1, gap: 2 },
  buddyTitle: { fontWeight: "700", color: colors.ink, fontSize: 15 },
  revoke: {
    minHeight: MIN_TOUCH,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  revokeLabel: { fontWeight: "700", color: colors.ember, fontSize: 14 },
});
