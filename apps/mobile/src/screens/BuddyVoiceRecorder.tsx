import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { NUDGE_CAPS, type NudgeMediaInline } from "@unloop/core";
import type { Translate } from "../i18n";
import { colors } from "../theme";
import { voiceFileToMedia } from "../buddyVoice";

type Props = {
  t: Translate;
  busy: boolean;
  onReady: (media: NudgeMediaInline, durationMs: number) => void;
  onStatus: (msg: string | null) => void;
  /** Live compose sits on the ink gradient. */
  onInk?: boolean;
};

/** Mono AAC voice preset kept under Phase 3.5 caps. */
const VOICE_PRESET = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 48_000,
  sampleRate: 22_050,
} as const;

export function BuddyVoiceRecorder({
  t,
  busy,
  onReady,
  onStatus,
  onInk,
}: Props) {
  const recorder = useAudioRecorder(VOICE_PRESET);
  const state = useAudioRecorderState(recorder, 250);
  const [recording, setRecording] = useState(false);
  const stoppingRef = useRef(false);
  const durationRef = useRef(0);

  useEffect(() => {
    durationRef.current = state.durationMillis ?? 0;
  }, [state.durationMillis]);

  const finish = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      const elapsed = durationRef.current;
      await recorder.stop();
      setRecording(false);
      const uri = recorder.uri;
      if (!uri) {
        onStatus(t("buddy.compose_voice_fail"));
        return;
      }
      const durationMs = Math.min(
        NUDGE_CAPS.voiceMaxMs,
        Math.max(elapsed, 500),
      );
      const media = await voiceFileToMedia(uri, durationMs);
      if (!media) {
        onStatus(t("buddy.compose_voice_too_big"));
        return;
      }
      onReady(media, durationMs);
      onStatus(t("buddy.compose_voice_ready"));
    } catch {
      onStatus(t("buddy.compose_voice_fail"));
      setRecording(false);
    } finally {
      stoppingRef.current = false;
    }
  }, [onReady, onStatus, recorder, t]);

  useEffect(() => {
    if (!recording) return;
    if ((state.durationMillis ?? 0) >= NUDGE_CAPS.voiceMaxMs) {
      void finish();
    }
  }, [finish, recording, state.durationMillis]);

  const start = useCallback(async () => {
    onStatus(null);
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      onStatus(t("buddy.compose_voice_perm"));
      return;
    }
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      onStatus(t("buddy.compose_voice_recording"));
    } catch {
      onStatus(t("buddy.compose_voice_fail"));
      setRecording(false);
    }
  }, [onStatus, recorder, t]);

  const secs = Math.floor((state.durationMillis ?? 0) / 1000);
  const maxSecs = Math.floor(NUDGE_CAPS.voiceMaxMs / 1000);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.meta, onInk && styles.metaOnInk]}>
        {recording
          ? t("buddy.compose_voice_timer", {
              secs: String(secs),
              max: String(maxSecs),
            })
          : t("buddy.compose_voice_lead")}
      </Text>
      <View style={styles.row}>
        {!recording ? (
          <Pressable
            style={[styles.btn, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void start()}
            accessibilityRole="button"
          >
            <Text style={styles.btnLabel}>{t("buddy.compose_voice_record")}</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.btnPrimary, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void finish()}
            accessibilityRole="button"
          >
            <Text style={styles.btnPrimaryLabel}>
              {t("buddy.compose_voice_stop")}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  meta: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  metaOnInk: { color: "rgba(242,245,248,0.7)" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
});
