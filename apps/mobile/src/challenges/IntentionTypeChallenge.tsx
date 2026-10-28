import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { Translate } from "../i18n";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onComplete: () => void;
};

const MIN_CHARS = 10;

/**
 * Free-text intention (not copy-the-phrase). Differs from unlock_phrase:
 * you invent what you will do instead of scrolling.
 */
export function IntentionTypeChallenge({ t, onComplete }: Props) {
  const [value, setValue] = useState("");
  const doneRef = useRef(false);

  const ready = value.trim().length >= MIN_CHARS;

  const submit = () => {
    if (doneRef.current || !ready) {
      return;
    }
    doneRef.current = true;
    onComplete();
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("challenge.intention.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.intention.body")}</Text>
      <Text style={styles.prompt}>{t("challenge.intention.prompt")}</Text>
      <TextInput
        style={[styles.input, { minHeight: 88, textAlignVertical: "top" }]}
        value={value}
        onChangeText={setValue}
        multiline
        autoCapitalize="sentences"
        autoCorrect
        accessibilityLabel="Intention free text"
        testID="intention-input"
        placeholder={t("challenge.intention.placeholder")}
        placeholderTextColor="rgba(242,245,248,0.35)"
      />
      <Text style={styles.meta}>
        {t("challenge.intention.meta", {
          n: Math.min(MIN_CHARS, value.trim().length),
          min: MIN_CHARS,
        })}
      </Text>
      <Pressable
        style={[styles.btn, !ready && { opacity: 0.45 }]}
        disabled={!ready}
        onPress={submit}
        accessibilityRole="button"
        testID="intention-submit"
      >
        <Text style={styles.btnLabel}>{t("challenge.intention.submit")}</Text>
      </Pressable>
    </View>
  );
}
