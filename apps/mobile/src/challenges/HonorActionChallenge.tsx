import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Translate } from "../i18n";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
  titleKey: string;
  bodyKey: string;
  confirmKey: string;
  waitKey: string;
  testID: string;
  lockoutMs?: number;
};

/** Body action we cannot verify — short lockout, then honor confirm. */
export function HonorActionChallenge({
  t,
  onComplete,
  titleKey,
  bodyKey,
  confirmKey,
  waitKey,
  testID,
  lockoutMs = 3500,
}: Props) {
  const [lockedUntil] = useState(() => Date.now() + lockoutMs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, lockedUntil - now);
  const locked = remainingMs > 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t(titleKey)}</Text>
      <Text style={styles.subtitle}>{t(bodyKey)}</Text>
      <Pressable
        style={[styles.btn, locked && { opacity: 0.45 }]}
        disabled={locked}
        onPress={onComplete}
        accessibilityRole="button"
        accessibilityLabel={testID}
        accessibilityState={{ disabled: locked }}
        testID={testID}
      >
        <Text style={styles.btnLabel}>
          {locked ? t(waitKey, { sec: remainingSec }) : t(confirmKey)}
        </Text>
      </Pressable>
    </View>
  );
}

export function StandUpChallenge({
  t,
  onComplete,
}: {
  t: Translate;
  onComplete: () => void;
}) {
  return (
    <HonorActionChallenge
      t={t}
      onComplete={onComplete}
      titleKey="challenge.stand_up.title"
      bodyKey="challenge.stand_up.body"
      confirmKey="challenge.stand_up.done"
      waitKey="challenge.stand_up.wait"
      testID="stand-up-done"
    />
  );
}

export function SipWaterChallenge({
  t,
  onComplete,
}: {
  t: Translate;
  onComplete: () => void;
}) {
  return (
    <HonorActionChallenge
      t={t}
      onComplete={onComplete}
      titleKey="challenge.sip_water.title"
      bodyKey="challenge.sip_water.body"
      confirmKey="challenge.sip_water.done"
      waitKey="challenge.sip_water.wait"
      testID="sip-water-done"
    />
  );
}
