import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { Translate } from "../i18n";
import { colors, typography } from "../theme";
import {
  stagedMediaFileUri,
  stagedNudgeSummary,
  type StagedNudge,
} from "../buddyNudgeStore";
import { SOUND_PRESET_I18N_KEYS } from "../buddySoundPresets";

function kindIcon(kind: StagedNudge["kind"]): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case "photo":
      return "image-outline";
    case "gif":
      return "images-outline";
    case "video":
      return "videocam-outline";
    case "voice":
      return "mic-outline";
    case "sound_preset":
      return "musical-notes-outline";
    default:
      return "chatbubble-outline";
  }
}

function ViewVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={styles.viewVideo}
      contentFit="contain"
      nativeControls
    />
  );
}

function ViewVoice({ uri }: { uri: string }) {
  const player = useAudioPlayer({ uri });
  useEffect(() => {
    void (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        player.seekTo(0);
        player.play();
      } catch {
        /* best-effort */
      }
    })();
  }, [player, uri]);
  return null;
}

type RowProps = {
  t: Translate;
  nudge: StagedNudge;
  busy?: boolean;
  onSend?: () => void;
  onDelete?: () => void;
};

/** Compact staged row: thumb/icon + summary + View (+ optional Send/Delete). */
export function StagedNudgeRow({
  t,
  nudge,
  busy,
  onSend,
  onDelete,
}: RowProps) {
  const [uri, setUri] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (
      nudge.kind === "photo" ||
      nudge.kind === "gif" ||
      nudge.kind === "video" ||
      nudge.kind === "voice"
    ) {
      void stagedMediaFileUri(nudge).then((path) => {
        if (!cancelled) setUri(path);
      });
    } else {
      setUri(null);
    }
    return () => {
      cancelled = true;
    };
  }, [nudge]);

  const summary =
    nudge.kind === "sound_preset" && nudge.presetId
      ? t(SOUND_PRESET_I18N_KEYS[nudge.presetId])
      : stagedNudgeSummary(nudge);

  return (
    <View style={styles.row}>
      <View style={styles.thumbWrap}>
        {uri && (nudge.kind === "photo" || nudge.kind === "gif") ? (
          <Image source={{ uri }} style={styles.thumb} />
        ) : (
          <Ionicons
            name={kindIcon(nudge.kind)}
            size={22}
            color={colors.ink}
          />
        )}
      </View>
      <View style={styles.main}>
        <Text style={styles.kind}>{t(`buddy.kind_${nudge.kind}`)}</Text>
        <Text style={styles.summary} numberOfLines={2}>
          {summary}
        </Text>
      </View>
      <Pressable
        style={styles.action}
        disabled={busy}
        onPress={() => setViewOpen(true)}
        accessibilityRole="button"
      >
        <Text style={styles.actionLabel}>{t("buddy.staged_view")}</Text>
      </Pressable>
      {onSend ? (
        <Pressable
          style={styles.action}
          disabled={busy}
          onPress={onSend}
          accessibilityRole="button"
        >
          <Text style={styles.sendLabel}>{t("buddy.compose_send_live")}</Text>
        </Pressable>
      ) : null}
      {onDelete ? (
        <Pressable
          style={styles.action}
          disabled={busy}
          onPress={onDelete}
          accessibilityRole="button"
        >
          <Text style={styles.deleteLabel}>
            {t("buddy.compose_staged_delete")}
          </Text>
        </Pressable>
      ) : null}

      <Modal
        visible={viewOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setViewOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setViewOpen(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>{t(`buddy.kind_${nudge.kind}`)}</Text>
            {uri && (nudge.kind === "photo" || nudge.kind === "gif") ? (
              <Image
                source={{ uri }}
                style={styles.viewImage}
                resizeMode="contain"
              />
            ) : null}
            {uri && nudge.kind === "video" ? <ViewVideo uri={uri} /> : null}
            {uri && nudge.kind === "voice" ? <ViewVoice uri={uri} /> : null}
            {nudge.kind === "voice" || nudge.kind === "sound_preset" ? (
              <View style={styles.iconHero}>
                <Ionicons
                  name={kindIcon(nudge.kind)}
                  size={48}
                  color={colors.ember}
                />
                <Text style={styles.modalBody}>{summary}</Text>
              </View>
            ) : null}
            {nudge.kind === "text" ? (
              <Text style={styles.modalBody}>{summary}</Text>
            ) : null}
            {nudge.body &&
            nudge.kind !== "text" &&
            nudge.kind !== "sound_preset" ? (
              <Text style={styles.modalCaption}>{nudge.body}</Text>
            ) : null}
            <Pressable
              style={styles.modalClose}
              onPress={() => setViewOpen(false)}
            >
              <Text style={styles.modalCloseLabel}>{t("nav.close")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.chipOff,
  },
  thumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumb: { width: 48, height: 48 },
  main: { flex: 1, gap: 2, minWidth: 0 },
  kind: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summary: { color: colors.ink, fontSize: 14, lineHeight: 18 },
  action: { paddingVertical: 6, paddingHorizontal: 4 },
  actionLabel: { fontWeight: "700", color: colors.teal, fontSize: 12 },
  sendLabel: { fontWeight: "700", color: colors.chipOn, fontSize: 12 },
  deleteLabel: { fontWeight: "700", color: colors.ember, fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 37, 64, 0.55)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: typography.bodySize,
    fontWeight: "800",
    color: colors.ink,
  },
  viewImage: { width: "100%", height: 280, borderRadius: 12 },
  viewVideo: { width: "100%", height: 280, borderRadius: 12 },
  iconHero: { alignItems: "center", gap: 12, paddingVertical: 24 },
  modalBody: {
    fontSize: typography.bodySize,
    lineHeight: 22,
    color: colors.ink,
    textAlign: "center",
  },
  modalCaption: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: "center",
  },
  modalClose: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  modalCloseLabel: { fontWeight: "700", color: colors.teal },
});
