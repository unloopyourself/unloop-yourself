import { Pressable, Text, View } from "react-native";
import type { Translate } from "../i18n";
import { challengeStyles as styles } from "./challengeUi";

type Props = {
  t: Translate;
  onAllow: () => void;
  onDeny: () => void;
};

/** Shown before any audio challenge — explicit local consent, not a system dialog. */
export function AudioConsentGate({ t, onAllow, onDeny }: Props) {
  return (
    <View style={styles.wrap} testID="audio-consent">
      <Text style={styles.title}>{t("challenge.audio_consent.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.audio_consent.body")}</Text>
      <View style={styles.row}>
        <Pressable
          style={styles.btn}
          onPress={onAllow}
          accessibilityRole="button"
          accessibilityLabel="Allow audio"
          testID="audio-consent-ok"
        >
          <Text style={styles.btnLabel}>{t("challenge.audio_consent.ok")}</Text>
        </Pressable>
        <Pressable
          style={styles.btnGhost}
          onPress={onDeny}
          accessibilityRole="button"
          accessibilityLabel="Decline audio"
          testID="audio-consent-no"
        >
          <Text style={styles.btnGhostLabel}>
            {t("challenge.audio_consent.no")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
