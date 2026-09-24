import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Translate } from "../i18n";
import { colors, typography } from "../theme";
import type { ChallengeId } from "./registry";
import { BreathTapChallenge } from "./BreathTapChallenge";
import { UnlockPhraseChallenge } from "./UnlockPhraseChallenge";
import { NearestMultipleChallenge } from "./NearestMultipleChallenge";
import { FaceDownFlipChallenge } from "./FaceDownFlipChallenge";
import { ShakeChallengeBody } from "./ShakeChallengeBody";

type Props = {
  challengeId: ChallengeId;
  timeoutMs: number;
  t: Translate;
  onComplete: () => void;
  onSoftFail: () => void;
};

export function ChallengeHost({
  challengeId,
  timeoutMs,
  t,
  onComplete,
  onSoftFail,
}: Props) {
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onSoftFailRef = useRef(onSoftFail);
  onCompleteRef.current = onComplete;
  onSoftFailRef.current = onSoftFail;

  const [remainingSec, setRemainingSec] = useState(Math.ceil(timeoutMs / 1000));

  useEffect(() => {
    doneRef.current = false;
    const started = Date.now();
    const tick = setInterval(() => {
      const left = Math.max(0, timeoutMs - (Date.now() - started));
      setRemainingSec(Math.ceil(left / 1000));
      if (left <= 0 && !doneRef.current) {
        doneRef.current = true;
        clearInterval(tick);
        onSoftFailRef.current();
      }
    }, 250);
    return () => clearInterval(tick);
  }, [timeoutMs, challengeId]);

  const finishComplete = useCallback(() => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    onCompleteRef.current();
  }, []);

  const finishSoftFail = useCallback(() => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    onSoftFailRef.current();
  }, []);

  return (
    <View style={styles.wrap}>
      {challengeId === "shake" && (
        <ShakeChallengeBody t={t} onComplete={finishComplete} />
      )}
      {challengeId === "breath_tap" && (
        <BreathTapChallenge t={t} onComplete={finishComplete} />
      )}
      {challengeId === "unlock_phrase" && (
        <UnlockPhraseChallenge t={t} onComplete={finishComplete} />
      )}
      {challengeId === "nearest_multiple" && (
        <NearestMultipleChallenge t={t} onComplete={finishComplete} />
      )}
      {challengeId === "face_down_flip" && (
        <FaceDownFlipChallenge t={t} onComplete={finishComplete} />
      )}

      <Text style={styles.timer}>{remainingSec}s</Text>
      <Pressable
        style={styles.skip}
        onPress={finishSoftFail}
        accessibilityRole="button"
        accessibilityLabel="Skip for now"
        testID="challenge-skip"
      >
        <Text style={styles.skipLabel}>{t("challenge.skip")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  timer: {
    marginTop: 4,
    fontSize: typography.metaSize,
    color: colors.emberSoft,
    opacity: 0.85,
  },
  skip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  skipLabel: {
    color: colors.textOnInk,
    opacity: 0.75,
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
