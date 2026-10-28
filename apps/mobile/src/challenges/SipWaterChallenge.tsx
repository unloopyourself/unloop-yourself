import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Translate } from "../i18n";
import { colors } from "../theme";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
};

type Step = 0 | 1 | 2 | 3;

const STEPS: {
  q: string;
  a: string;
  b: string;
}[] = [
  {
    q: "challenge.sip_water.q_temp",
    a: "challenge.sip_water.hot",
    b: "challenge.sip_water.cold",
  },
  {
    q: "challenge.sip_water.q_gas",
    a: "challenge.sip_water.sparkling",
    b: "challenge.sip_water.still",
  },
  {
    q: "challenge.sip_water.q_taste",
    a: "challenge.sip_water.soft",
    b: "challenge.sip_water.hard",
  },
];

/** Honor sip + describe it (temp / gas / mineral feel). */
export function SipWaterChallenge({ t, onComplete }: Props) {
  const [step, setStep] = useState<Step>(0);
  const doneRef = useRef(false);

  const onPick = () => {
    if (doneRef.current) {
      return;
    }
    if (step < 3) {
      const next = (step + 1) as Step;
      setStep(next);
      if (next === 3) {
        /* show confirm */
      }
      return;
    }
    doneRef.current = true;
    onComplete();
  };

  if (step === 3) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{t("challenge.sip_water.title")}</Text>
        <Text style={styles.subtitle}>{t("challenge.sip_water.body_done")}</Text>
        <Pressable
          style={styles.btn}
          onPress={onPick}
          accessibilityRole="button"
          testID="sip-water-done"
        >
          <Text style={styles.btnLabel}>{t("challenge.sip_water.done")}</Text>
        </Pressable>
      </View>
    );
  }

  const s = STEPS[step]!;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.sip_water.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.sip_water.body")}</Text>
      <Text style={styles.prompt}>{t(s.q)}</Text>
      <View style={[styles.row, { width: "100%" }]}>
        <Pressable
          style={[styles.btnGhost, { flexGrow: 1, backgroundColor: colors.inkSoft }]}
          onPress={onPick}
          testID={`sip-a-${step}`}
        >
          <Text style={styles.btnGhostLabel}>{t(s.a)}</Text>
        </Pressable>
        <Pressable
          style={[styles.btnGhost, { flexGrow: 1, backgroundColor: colors.inkSoft }]}
          onPress={onPick}
          testID={`sip-b-${step}`}
        >
          <Text style={styles.btnGhostLabel}>{t(s.b)}</Text>
        </Pressable>
      </View>
      <Text style={styles.meta}>
        {t("challenge.sip_water.step", { n: step + 1, total: 3 })}
      </Text>
    </View>
  );
}
