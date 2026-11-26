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
  addStagedNudge,
  encodeNudgeBlob,
  loadStagedNudges,
  type PendingApproach,
  type StagedNudge,
} from "../buddyNudgeStore";
import {
  captureCompressedPhoto,
  pickCompressedPhoto,
} from "../buddyMediaEncode";
import {
  SOUND_PRESET_I18N_KEYS,
} from "../buddySoundPresets";
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

  const uploadPreset = useCallback(
    async (presetId: SoundPresetId) => {
      const caption = live.trim() || undefined;
      await putCipher(
        encodeNudgeEnvelope(soundPresetNudgeEnvelope(presetId, caption)),
      );
    },
    [live, putCipher],
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
      setPhoto(media);
      setStatus(t("buddy.compose_photo_ready"));
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
      {staged.length === 0 ? (
        <Text style={styles.meta}>{t("buddy.compose_staged_empty")}</Text>
      ) : (
        staged.map((n) => (
          <Pressable
            key={n.id}
            style={[styles.staged, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void upload(n.body)}
          >
            <Text style={styles.stagedBody}>{n.body}</Text>
          </Pressable>
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
      </View>
      {photo ? (
        <Image
          source={{ uri: `data:${photo.mime};base64,${photo.data}` }}
          style={styles.preview}
          accessibilityLabel={t("buddy.compose_photo")}
        />
      ) : null}

      <Text style={styles.section}>{t("buddy.compose_presets")}</Text>
      <Text style={styles.meta}>{t("buddy.compose_presets_lead")}</Text>
      <View style={styles.row}>
        {SOUND_PRESET_IDS.map((id) => (
          <Pressable
            key={id}
            style={[styles.btn, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void uploadPreset(id)}
            accessibilityRole="button"
          >
            <Text style={styles.btnLabel}>{t(SOUND_PRESET_I18N_KEYS[id])}</Text>
          </Pressable>
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
  staged: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.chipOff,
  },
  stagedBody: { color: colors.ink, fontSize: 15, lineHeight: 20 },
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
