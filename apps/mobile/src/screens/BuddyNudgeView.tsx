import { useEffect, useRef } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Audio } from "expo-av";
import type { SoundPresetId } from "@unloop/core";
import type { Translate } from "../i18n";
import { colors, typography } from "../theme";
import {
  SOUND_PRESET_ASSETS,
  SOUND_PRESET_I18N_KEYS,
} from "../buddySoundPresets";

type Props = {
  t: Translate;
  body: string;
  presetId?: SoundPresetId;
  mediaUri?: string;
  onContinue: () => void;
};

/** Interrupt surface for a buddy nudge (text, photo, and/or sound preset). */
export function BuddyNudgeView({
  t,
  body,
  presetId,
  mediaUri,
  onContinue,
}: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function play() {
      if (!presetId) return;
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          SOUND_PRESET_ASSETS[presetId],
          { shouldPlay: true, volume: 1 },
        );
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
      } catch {
        /* best-effort playback */
      }
    }
    void play();
    return () => {
      cancelled = true;
      const s = soundRef.current;
      soundRef.current = null;
      if (s) void s.unloadAsync();
    };
  }, [presetId]);

  const caption =
    body &&
    !(presetId && body === presetId) &&
    !(presetId && body === "sound_preset") &&
    body !== "photo"
      ? body
      : presetId
        ? t(SOUND_PRESET_I18N_KEYS[presetId])
        : mediaUri
          ? t("buddy.nudge_photo")
          : body;

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>{t("buddy.nudge_from")}</Text>
      {presetId ? (
        <Text style={styles.preset}>{t("buddy.nudge_playing_sound")}</Text>
      ) : null}
      {mediaUri ? (
        <Image
          source={{ uri: mediaUri }}
          style={styles.photo}
          accessibilityLabel={t("buddy.nudge_photo")}
        />
      ) : null}
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
