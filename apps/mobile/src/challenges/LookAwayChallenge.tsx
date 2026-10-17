import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Translate } from "../i18n";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
};

const LOCKOUT_MS = 4000;

/** Eyes-off glass: button locked while you look away, then confirm return. */
export function LookAwayChallenge({ t, onComplete }: Props) {
  const [lockedUntil] = useState(() => Date.now() + LOCKOUT_MS);
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
      <Text style={styles.title}>{t("challenge.look_away.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.look_away.body")}</Text>
      <Pressable
        style={[styles.btn, locked && { opacity: 0.45 }]}
        disabled={locked}
        onPress={onComplete}
        accessibilityRole="button"
        accessibilityLabel="Look away done"
        accessibilityState={{ disabled: locked }}
        testID="look-away-done"
      >
        <Text style={styles.btnLabel}>
          {locked
            ? t("challenge.look_away.wait", { sec: remainingSec })
            : t("challenge.look_away.done")}
        </Text>
      </Pressable>
    </View>
  );
}
