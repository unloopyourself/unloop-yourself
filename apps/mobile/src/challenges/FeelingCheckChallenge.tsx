import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Translate } from "../i18n";
import { colors } from "../theme";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
};

const FEELINGS = [
  {
    key: "challenge.feeling.bored",
    tip: "challenge.feeling.tip_bored",
    heavy: true,
  },
  {
    key: "challenge.feeling.anxious",
    tip: "challenge.feeling.tip_anxious",
    heavy: true,
  },
  {
    key: "challenge.feeling.tired",
    tip: "challenge.feeling.tip_tired",
    heavy: true,
  },
  {
    key: "challenge.feeling.curious",
    tip: "challenge.feeling.tip_curious",
    heavy: false,
  },
] as const;

/** Name the feeling; soft tip for heavier moods, then continue. */
export function FeelingCheckChallenge({ t, onComplete }: Props) {
  const [tipKey, setTipKey] = useState<string | null>(null);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    onComplete();
  };

  if (tipKey) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{t("challenge.feeling.title")}</Text>
        <Text style={styles.subtitle}>{t(tipKey)}</Text>
        <Pressable style={styles.btn} onPress={finish} testID="feeling-continue">
          <Text style={styles.btnLabel}>{t("challenge.feeling.continue")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.feeling.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.feeling.body")}</Text>
      <View style={[styles.row, { width: "100%" }]}>
        {FEELINGS.map((f, index) => (
          <Pressable
            key={f.key}
            style={[
              styles.btnGhost,
              {
                flexGrow: 1,
                minWidth: "40%",
                backgroundColor: colors.inkSoft,
              },
            ]}
            onPress={() => {
              if (f.heavy || f.tip) {
                setTipKey(f.tip);
                return;
              }
              finish();
            }}
            accessibilityRole="button"
            accessibilityLabel={t(f.key)}
            testID={`feeling-${index}`}
          >
            <Text style={styles.btnGhostLabel}>{t(f.key)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
