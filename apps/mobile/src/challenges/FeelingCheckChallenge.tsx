import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import type { Translate } from "../i18n";
import { colors } from "../theme";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
};

const FEELINGS = [
  "challenge.feeling.bored",
  "challenge.feeling.anxious",
  "challenge.feeling.tired",
  "challenge.feeling.curious",
] as const;

/** Name the feeling — deliberation beat, then exit. Any choice completes. */
export function FeelingCheckChallenge({ t, onComplete }: Props) {
  const doneRef = useRef(false);

  const onPick = () => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    onComplete();
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.feeling.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.feeling.body")}</Text>
      <View style={[styles.row, { width: "100%" }]}>
        {FEELINGS.map((key, index) => (
          <Pressable
            key={key}
            style={[
              styles.btnGhost,
              {
                flexGrow: 1,
                minWidth: "40%",
                backgroundColor: colors.inkSoft,
              },
            ]}
            onPress={onPick}
            accessibilityRole="button"
            accessibilityLabel={t(key)}
            testID={`feeling-${index}`}
          >
            <Text style={styles.btnGhostLabel}>{t(key)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
