import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import type { BuddyRecord } from "@unloop/core";
import type { Translate } from "../i18n";
import { colors, typography } from "../theme";
import { statusBarTopInset } from "../layout";
import {
  acceptInviteLink,
  buildMyInvite,
  loadBuddies,
  revokeBuddy,
  shortFingerprint,
} from "../buddyStore";

type Props = {
  t: Translate;
  onBack: () => void;
  /** Deep-link payload to accept once on mount (optional). */
  pendingInvite?: string | null;
  onPendingInviteConsumed?: () => void;
};

export function BuddyScreen({
  t,
  onBack,
  pendingInvite,
  onPendingInviteConsumed,
}: Props) {
  const [link, setLink] = useState<string>("");
  const [myFp, setMyFp] = useState<string>("");
  const [buddies, setBuddies] = useState<BuddyRecord[]>([]);
  const [paste, setPaste] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [{ link: inviteLink, invite }, list] = await Promise.all([
      buildMyInvite("seeker"),
      loadBuddies(),
    ]);
    setLink(inviteLink);
    setMyFp(shortFingerprint(invite.pub));
    setBuddies(list);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyInvite = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      setBusy(true);
      try {
        const result = await acceptInviteLink(trimmed);
        if (!result.ok) {
          setStatus(t(`buddy.accept_${result.reason}`));
          return;
        }
        const fp = shortFingerprint(result.buddy.pub);
        setStatus(
          t(result.alreadyPaired ? "buddy.accept_already" : "buddy.accept_ok", {
            fp,
          }),
        );
        setPaste("");
        setBuddies(await loadBuddies());
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!pendingInvite) return;
    void (async () => {
      await applyInvite(pendingInvite);
      onPendingInviteConsumed?.();
    })();
  }, [pendingInvite, applyInvite, onPendingInviteConsumed]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: statusBarTopInset(4) },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={onBack}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel={t("nav.back")}
      >
        <Text style={styles.backLabel}>← {t("nav.back")}</Text>
      </Pressable>

      <Text style={styles.title}>{t("buddy.title")}</Text>
      <Text style={styles.lead}>{t("buddy.lead")}</Text>

      <Text style={styles.section}>{t("buddy.your_invite")}</Text>
      <Text style={styles.meta}>{t("buddy.fingerprint", { fp: myFp || "…" })}</Text>
      <Text style={styles.hint}>{t("buddy.scan_hint")}</Text>

      {link ? (
        <View style={styles.qrWrap} accessibilityLabel="Buddy invite QR code">
          <QRCode value={link} size={200} backgroundColor={colors.white} color={colors.ink} />
        </View>
      ) : null}

      <View style={styles.row}>
        <Pressable
          style={styles.btn}
          onPress={() => {
            void Clipboard.setStringAsync(link).then(() =>
              setStatus(t("buddy.copied")),
            );
          }}
          accessibilityRole="button"
        >
          <Text style={styles.btnLabel}>{t("buddy.copy_link")}</Text>
        </Pressable>
        <Pressable
          style={styles.btn}
          onPress={() => {
            void Share.share({ message: link });
          }}
          accessibilityRole="button"
        >
          <Text style={styles.btnLabel}>{t("buddy.share_link")}</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>{t("buddy.paste_label")}</Text>
      <TextInput
        style={styles.input}
        value={paste}
        onChangeText={setPaste}
        placeholder={t("buddy.paste_placeholder")}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      <Pressable
        style={[styles.btnPrimary, busy && styles.btnDisabled]}
        disabled={busy}
        onPress={() => void applyInvite(paste)}
        accessibilityRole="button"
      >
        <Text style={styles.btnPrimaryLabel}>{t("buddy.accept")}</Text>
      </Pressable>

      {status ? <Text style={styles.status}>{status}</Text> : null}

      <Text style={styles.section}>{t("buddy.paired_list")}</Text>
      {buddies.length === 0 ? (
        <Text style={styles.meta}>{t("buddy.empty")}</Text>
      ) : (
        buddies.map((b) => (
          <View key={b.buddyId} style={styles.buddyRow}>
            <View style={styles.buddyMain}>
              <Text style={styles.buddyTitle}>
                {b.displayLabel ?? shortFingerprint(b.pub)}
              </Text>
              <Text style={styles.meta}>
                {b.role === "buddy" ? t("buddy.role_buddy") : t("buddy.role_seeker")}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                void revokeBuddy(b.buddyId).then(setBuddies);
              }}
              style={styles.revoke}
              accessibilityRole="button"
            >
              <Text style={styles.revokeLabel}>{t("buddy.revoke")}</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 48,
    gap: 12,
  },
  back: { alignSelf: "flex-start", paddingVertical: 8 },
  backLabel: { fontSize: 15, fontWeight: "700", color: colors.teal },
  title: {
    fontSize: typography.titleSize,
    fontWeight: "800",
    color: colors.ink,
  },
  lead: {
    fontSize: typography.bodySize,
    lineHeight: 22,
    color: colors.textMuted,
  },
  section: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  meta: { fontSize: typography.metaSize, color: colors.textMuted },
  hint: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  qrWrap: {
    alignSelf: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: {
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
  btnDisabled: { opacity: 0.5 },
  input: {
    minHeight: 72,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 14,
    textAlignVertical: "top",
  },
  status: { fontSize: 14, color: colors.teal, fontWeight: "600" },
  buddyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.chipOff,
  },
  buddyMain: { flex: 1, gap: 2 },
  buddyTitle: { fontWeight: "700", color: colors.ink, fontSize: 15 },
  revoke: { paddingVertical: 8, paddingHorizontal: 10 },
  revokeLabel: { fontWeight: "700", color: colors.ember, fontSize: 13 },
});
