import { useCallback, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { NUDGE_CAPS } from "@unloop/core";
import type { Translate } from "../i18n";
import { colors } from "../theme";
import {
  videoFileToResult,
  type VideoNudgeMedia,
  videoPickFailureI18nKey,
} from "../buddyMediaEncode";

type Props = {
  t: Translate;
  busy: boolean;
  onReady: (media: VideoNudgeMedia) => void;
  onStatus: (msg: string | null) => void;
};

/**
 * In-app 480p recorder with hard maxDuration + maxFileSize.
 * System OEM cameras (Nokia/Samsung) often ignore ImagePicker quality and
 * emit multi‑10 MiB clips in a few seconds — this path keeps us under cap.
 */
export function BuddyVideoRecorder({ t, busy, onReady, onStatus }: Props) {
  const camRef = useRef<CameraView>(null);
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  /** Buddy nudges are usually selfies — default front. */
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const stoppingRef = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
    setRecording(false);
    stoppingRef.current = false;
    setFacing("front");
  }, []);

  const flip = useCallback(() => {
    if (recording) return;
    setFacing((prev) => (prev === "front" ? "back" : "front"));
  }, [recording]);

  const stop = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      camRef.current?.stopRecording();
    } catch {
      /* stop is best-effort */
    }
  }, []);

  const start = useCallback(async () => {
    if (!camRef.current || recording || busy) return;
    onStatus(null);
    setRecording(true);
    stoppingRef.current = false;
    try {
      const startedAt = Date.now();
      const clip = await camRef.current.recordAsync({
        maxDuration: Math.floor(NUDGE_CAPS.videoMaxMs / 1000),
        // Leave headroom so base64 + envelope stay under the 8 MiB relay cap.
        maxFileSize: Math.floor(NUDGE_CAPS.videoBytes * 0.9),
      });
      setRecording(false);
      const uri = clip?.uri;
      if (!uri) {
        onStatus(t("buddy.compose_video_cancel"));
        close();
        return;
      }
      const elapsed = Date.now() - startedAt;
      const result = await videoFileToResult(uri, "video/mp4", elapsed);
      if (!result.ok) {
        onStatus(t(videoPickFailureI18nKey(result.reason)));
        close();
        return;
      }
      onReady(result.media);
      onStatus(t("buddy.compose_video_ready"));
      close();
    } catch {
      setRecording(false);
      onStatus(t("buddy.compose_video_cancel"));
      close();
    }
  }, [busy, close, onReady, onStatus, recording, t]);

  const openRecorder = useCallback(async () => {
    onStatus(null);
    let cam = camPerm;
    if (!cam?.granted) {
      cam = await requestCamPerm();
    }
    if (!cam?.granted) {
      onStatus(t("buddy.compose_video_perm"));
      return;
    }
    let mic = micPerm;
    if (!mic?.granted) {
      mic = await requestMicPerm();
    }
    // Mic optional for some devices, but preferred for buddy nudges.
    setOpen(true);
  }, [camPerm, micPerm, onStatus, requestCamPerm, requestMicPerm, t]);

  return (
    <View>
      <Pressable
        style={[styles.btn, (busy || recording) && styles.btnDisabled]}
        disabled={busy || recording}
        onPress={() => void openRecorder()}
        accessibilityRole="button"
      >
        <Text style={styles.btnLabel}>{t("buddy.compose_video_camera")}</Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => {
          if (recording) void stop();
          else close();
        }}
      >
        <View style={styles.modal}>
          <View style={styles.previewWrap}>
            <CameraView
              ref={camRef}
              style={styles.preview}
              mode="video"
              facing={facing}
              mirror={facing === "front"}
              videoQuality="480p"
              // ~1 Mbps keeps ~10s well under the mailbox cap on low-end OEMs.
              videoBitrate={1_000_000}
              mute={false}
            />
            <Pressable
              style={[styles.flipBtn, recording && styles.btnDisabled]}
              disabled={recording}
              onPress={flip}
              accessibilityRole="button"
              accessibilityLabel={t("buddy.compose_video_flip")}
            >
              <Text style={styles.flipLabel}>
                {t("buddy.compose_video_flip")}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>{t("buddy.compose_video_inapp_hint")}</Text>
          <View style={styles.actions}>
            {!recording ? (
              <Pressable
                style={styles.btnPrimary}
                onPress={() => void start()}
                accessibilityRole="button"
              >
                <Text style={styles.btnPrimaryLabel}>
                  {t("buddy.compose_video_rec_start")}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.btnStop}
                onPress={() => void stop()}
                accessibilityRole="button"
              >
                <Text style={styles.btnPrimaryLabel}>
                  {t("buddy.compose_video_rec_stop")}
                </Text>
              </Pressable>
            )}
            <Pressable
              style={styles.btn}
              disabled={recording}
              onPress={close}
              accessibilityRole="button"
            >
              <Text style={styles.btnLabel}>{t("buddy.compose_ignore")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.chipOff,
  },
  btnDisabled: { opacity: 0.5 },
  btnLabel: { fontWeight: "700", color: colors.ink, fontSize: 14 },
  btnPrimary: {
    flex: 1,
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: colors.teal,
    paddingHorizontal: 16,
  },
  btnStop: {
    flex: 1,
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: colors.ember,
    paddingHorizontal: 16,
  },
  btnPrimaryLabel: { fontWeight: "800", color: colors.white, fontSize: 15 },
  modal: {
    flex: 1,
    backgroundColor: colors.ink,
    paddingTop: 48,
    paddingBottom: 28,
    paddingHorizontal: 16,
    gap: 12,
  },
  previewWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  preview: { flex: 1 },
  flipBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(10,37,64,0.72)",
    justifyContent: "center",
  },
  flipLabel: { color: colors.white, fontWeight: "700", fontSize: 14 },
  hint: { color: colors.white, fontSize: 13, opacity: 0.85, textAlign: "center" },
  actions: { flexDirection: "row", gap: 10, alignItems: "center" },
});
