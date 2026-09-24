import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import {
  SessionFsm,
  TypedEventEmitter,
  evaluatePolicy,
  type Capability,
  type SessionState,
  type UsageThresholdEvent,
} from "@unloop/core";
import { AndroidUsageDetector } from "./src/androidUsageDetector";
import { MemoryStoragePort } from "./src/memoryStorage";
import { LocalAuditTrail } from "./src/localAuditTrail";
import UnloopUsage, {
  addOpenChallengeListener,
  type MonitorSnapshot,
} from "./modules/unloop-usage/src/UnloopUsageModule";
import { colors, typography } from "./src/theme";
import { WATCH_TARGETS, packagesForLabels } from "./src/targets";
import { loadSettings, saveSettings, type UnloopSettings } from "./src/settings";
import { createTranslator, detectLocale } from "./src/i18n";
import {
  CHALLENGE_CATALOG,
  pickChallengeId,
  type ChallengeId,
} from "./src/challenges/registry";
import { ChallengeHost } from "./src/challenges/ChallengeHost";

type DomainEvents = {
  CHALLENGE_COMPLETED: { atMs: number };
  THRESHOLD_REACHED: { appId: string; deltaU: number };
};

function targetStateFromSnapshot(snap: MonitorSnapshot): SessionState | null {
  if (!snap.monitoring) {
    return null;
  }
  if (snap.challengeOutstanding && !snap.inCooldown) {
    return "CHALLENGE";
  }
  if (snap.inCooldown) {
    return "COOLDOWN";
  }
  return "MONITORING";
}

const SENSOR_CAPS: ReadonlySet<Capability> = new Set(["accelerometer"]);

export default function App() {
  const t = useMemo(() => createTranslator(detectLocale()), []);
  const storage = useMemo(() => new MemoryStoragePort(), []);
  const audit = useMemo(() => new LocalAuditTrail(storage), [storage]);
  const bus = useMemo(() => new TypedEventEmitter<DomainEvents>(), []);
  const fsm = useMemo(() => new SessionFsm(), []);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<UnloopSettings | null>(null);

  const [sessionState, setSessionState] = useState(fsm.state);
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const [permission, setPermission] = useState<boolean | null>(null);
  const [overlayPermission, setOverlayPermission] = useState<boolean | null>(
    null,
  );
  const [settings, setSettings] = useState<UnloopSettings | null>(null);
  const [activeChallengeId, setActiveChallengeId] = useState<ChallengeId>("shake");
  const [message, setMessage] = useState(t("app.intro"));

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const persist = useCallback((next: UnloopSettings) => {
    setSettings(next);
    void saveSettings(next);
  }, []);

  const clearCooldownTimer = useCallback(() => {
    if (cooldownTimerRef.current != null) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  const scheduleCooldownEnd = useCallback(
    (untilMs: number) => {
      clearCooldownTimer();
      const wait = Math.max(0, untilMs - Date.now());
      cooldownTimerRef.current = setTimeout(() => {
        cooldownTimerRef.current = null;
        if (fsm.state === "COOLDOWN") {
          UnloopUsage.clearCooldown();
          setSessionState(fsm.dispatch({ type: "COOLDOWN_ELAPSED" }));
          setMessage(t("app.back_on_watch"));
        }
      }, wait);
    },
    [clearCooldownTimer, fsm, t],
  );

  const beginCooldown = useCallback(
    (kind: "ok" | "soft") => {
      const s = settingsRef.current;
      const cooldownMs = s?.cooldownMs ?? 120_000;
      UnloopUsage.dismissInterruptOverlay();
      const until = Date.now() + cooldownMs;
      UnloopUsage.setCooldownUntilMs(until);
      if (fsm.state === "CHALLENGE") {
        setSessionState(
          fsm.dispatch({
            type: kind === "ok" ? "CHALLENGE_COMPLETED" : "CHALLENGE_FAILED",
          }),
        );
      } else {
        setSessionState(fsm.hydrate("COOLDOWN"));
      }
      setMessage(
        kind === "ok"
          ? t("app.challenge_ok", { cooldown: Math.round(cooldownMs / 1000) })
          : t("app.soft_fail"),
      );
      scheduleCooldownEnd(until);
    },
    [fsm, scheduleCooldownEnd, t],
  );

  const assignChallenge = useCallback(() => {
    const s = settingsRef.current;
    const id = pickChallengeId(s?.enabledChallengeIds ?? ["shake"], SENSOR_CAPS);
    setActiveChallengeId(id);
    return id;
  }, []);

  const enterChallengeFromNative = useCallback(
    (deltaU?: number) => {
      if (deltaU != null && deltaU > 0) {
        setLastDelta(deltaU);
      }
      assignChallenge();
      if (fsm.state === "CHALLENGE") {
        setMessage(t("app.interrupt"));
        return;
      }
      if (fsm.state === "PAUSED") {
        fsm.hydrate("MONITORING");
      }
      if (fsm.state === "MONITORING") {
        setSessionState(fsm.dispatch({ type: "THRESHOLD_REACHED" }));
      } else {
        setSessionState(fsm.hydrate("CHALLENGE"));
      }
      setMessage(t("app.interrupt"));
    },
    [assignChallenge, fsm, t],
  );

  useEffect(() => {
    void loadSettings().then((s) => {
      setSettings(s);
      settingsRef.current = s;
    });
  }, []);

  useEffect(() => {
    return bus.on("CHALLENGE_COMPLETED", (payload) => {
      void audit.append({
        type: "CHALLENGE_COMPLETED",
        atMs: payload.atMs,
        detail: "challenge",
      });
    });
  }, [audit, bus]);

  const onThreshold = useCallback(
    (event: UsageThresholdEvent) => {
      setLastDelta(event.deltaU);
      const decision = evaluatePolicy({
        inCooldown: fsm.state === "COOLDOWN",
        thresholdReached: true,
      });
      if (decision.action !== "interrupt") {
        return;
      }
      if (fsm.state === "MONITORING") {
        assignChallenge();
        setSessionState(fsm.dispatch({ type: "THRESHOLD_REACHED" }));
        bus.emit("THRESHOLD_REACHED", {
          appId: event.appId,
          deltaU: event.deltaU,
        });
        void audit.append({
          type: "THRESHOLD_REACHED",
          atMs: event.observedAtMs,
          detail: event.appId,
        });
        setMessage(t("app.interrupt"));
      }
    },
    [assignChallenge, audit, bus, fsm, t],
  );

  const detector = useMemo(
    () => new AndroidUsageDetector(onThreshold),
    [onThreshold],
  );

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    setPermission(detector.hasPermission());
    setOverlayPermission(detector.hasOverlayPermission());
    const snap = UnloopUsage.getMonitorSnapshot();
    if (snap.monitoring) {
      detector.ensureListening();
      const target = targetStateFromSnapshot(snap);
      if (target != null && fsm.state !== target) {
        if (target === "CHALLENGE") {
          assignChallenge();
        }
        setSessionState(fsm.hydrate(target));
        if (target === "CHALLENGE") {
          setMessage(t("app.interrupt"));
        } else if (target === "COOLDOWN") {
          scheduleCooldownEnd(snap.cooldownUntilMs);
        }
      }
      if (snap.lastDeltaU > 0) {
        setLastDelta(snap.lastDeltaU);
      }
    }
  }, [assignChallenge, detector, fsm, scheduleCooldownEnd, t]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    const onAppState = (next: string) => {
      if (next !== "active") {
        return;
      }
      const snap = UnloopUsage.getMonitorSnapshot();
      if (!snap.monitoring) {
        return;
      }
      detector.ensureListening();
      const target = targetStateFromSnapshot(snap);
      if (target == null) {
        return;
      }
      if (target === "CHALLENGE") {
        assignChallenge();
      }
      if (fsm.state !== target) {
        setSessionState(fsm.hydrate(target));
      }
      if (target === "CHALLENGE") {
        setMessage(t("app.interrupt"));
      } else if (target === "COOLDOWN") {
        scheduleCooldownEnd(snap.cooldownUntilMs);
      }
      if (snap.lastDeltaU > 0) {
        setLastDelta(snap.lastDeltaU);
      }
    };
    const sub = AppState.addEventListener("change", onAppState);
    return () => sub.remove();
  }, [assignChallenge, detector, fsm, scheduleCooldownEnd, t]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    const sub = addOpenChallengeListener(() => {
      const snap = UnloopUsage.getMonitorSnapshot();
      enterChallengeFromNative(snap.lastDeltaU);
    });
    return () => sub.remove();
  }, [enterChallengeFromNative]);

  useEffect(() => () => clearCooldownTimer(), [clearCooldownTimer]);

  const toggleLabel = (label: string) => {
    if (!settings) {
      return;
    }
    const next = settings.enabledLabels.includes(label)
      ? settings.enabledLabels.filter((l) => l !== label)
      : [...settings.enabledLabels, label];
    const safe = next.length === 0 ? [label] : next;
    const updated = { ...settings, enabledLabels: safe };
    persist(updated);
    if (
      Platform.OS === "android" &&
      (sessionState === "MONITORING" || sessionState === "COOLDOWN")
    ) {
      const packages = packagesForLabels(safe);
      if (packages.length > 0) {
        UnloopUsage.updateMonitoredPackages(packages.join(","));
        setMessage(
          t("app.watching", {
            feeds: safe.join(", "),
            threshold: Math.round(updated.thresholdMs / 1000),
            cooldown: Math.round(updated.cooldownMs / 1000),
          }),
        );
      }
    }
  };

  const toggleChallenge = (id: ChallengeId) => {
    if (!settings) {
      return;
    }
    const on = settings.enabledChallengeIds.includes(id);
    let next = on
      ? settings.enabledChallengeIds.filter((c) => c !== id)
      : [...settings.enabledChallengeIds, id];
    if (next.length === 0) {
      next = [id];
    }
    persist({ ...settings, enabledChallengeIds: next });
  };

  const setTiming = (
    key: "thresholdMs" | "cooldownMs" | "challengeTimeoutMs",
    secondsText: string,
  ) => {
    if (!settings) {
      return;
    }
    const sec = Number(secondsText);
    if (!Number.isFinite(sec) || sec <= 0) {
      return;
    }
    const ms = Math.round(sec * 1000);
    persist({ ...settings, [key]: ms });
  };

  const startMonitoring = async () => {
    if (!settings) {
      return;
    }
    if (Platform.OS !== "android") {
      setMessage(t("app.android_only"));
      return;
    }
    if (!detector.hasPermission()) {
      setPermission(false);
      setMessage(t("app.grant_usage"));
      detector.openSettings();
      return;
    }
    setPermission(true);
    if (!detector.hasOverlayPermission()) {
      setOverlayPermission(false);
      setMessage(t("app.grant_overlay"));
      detector.openOverlaySettings();
      return;
    }
    setOverlayPermission(true);
    const packages = packagesForLabels(settings.enabledLabels);
    if (packages.length === 0) {
      setMessage(t("app.pick_feed"));
      return;
    }
    if (fsm.state === "PAUSED") {
      setSessionState(fsm.dispatch({ type: "START_MONITORING" }));
    }
    await detector.start({
      appId: packages.join(","),
      thresholdUnits: settings.thresholdMs,
    });
    setMessage(
      t("app.watching", {
        feeds: settings.enabledLabels.join(", "),
        threshold: Math.round(settings.thresholdMs / 1000),
        cooldown: Math.round(settings.cooldownMs / 1000),
      }),
    );
  };

  const stopMonitoring = async () => {
    clearCooldownTimer();
    await detector.stop();
    UnloopUsage.clearCooldown();
    if (fsm.state !== "PAUSED") {
      setSessionState(fsm.dispatch({ type: "STOP" }));
    }
    setMessage(t("app.stopped"));
  };

  const completeChallenge = useCallback(() => {
    if (fsm.state !== "CHALLENGE") {
      return;
    }
    bus.emit("CHALLENGE_COMPLETED", { atMs: Date.now() });
    beginCooldown("ok");
  }, [beginCooldown, bus, fsm]);

  const softFailChallenge = useCallback(() => {
    if (fsm.state !== "CHALLENGE") {
      return;
    }
    beginCooldown("soft");
  }, [beginCooldown, fsm]);

  const inChallenge = sessionState === "CHALLENGE";
  const monitoring = sessionState === "MONITORING" || sessionState === "COOLDOWN";

  return (
    <LinearGradient
      colors={
        inChallenge
          ? [colors.ink, colors.inkSoft]
          : [colors.mist, colors.mistEnd]
      }
      style={styles.gradient}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.brand, inChallenge && styles.brandOnInk]}>
          Unloop
        </Text>
        <Text style={[styles.tagline, inChallenge && styles.textOnInk]}>
          {t("app.tagline")}
        </Text>
        <Text style={[styles.meta, inChallenge && styles.textOnInkMuted]}>
          {sessionState}
          {lastDelta != null
            ? ` · last bout ${Math.round(lastDelta / 1000)}s`
            : ""}
        </Text>

        {!inChallenge && <Text style={styles.copy}>{message}</Text>}
        {inChallenge && settings && (
          <ChallengeHost
            challengeId={activeChallengeId}
            timeoutMs={settings.challengeTimeoutMs}
            t={t}
            onComplete={completeChallenge}
            onSoftFail={softFailChallenge}
          />
        )}

        {!inChallenge && settings && (
          <>
            <Text style={styles.section}>{t("app.feeds_section")}</Text>
            <View style={styles.chips}>
              {WATCH_TARGETS.map((app) => {
                const on = settings.enabledLabels.includes(app.label);
                return (
                  <Pressable
                    key={app.label}
                    onPress={() => toggleLabel(app.label)}
                    style={[styles.chip, on && styles.chipOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>
                      {app.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.section}>{t("app.challenges_section")}</Text>
            <View style={styles.chips}>
              {CHALLENGE_CATALOG.map((c) => {
                const on = settings.enabledChallengeIds.includes(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => toggleChallenge(c.id)}
                    style={[styles.chip, on && styles.chipOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>
                      {t(c.titleKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.section}>{t("app.timings_section")}</Text>
            <TimingRow
              label={t("app.threshold")}
              seconds={Math.round(settings.thresholdMs / 1000)}
              onCommit={(s) => setTiming("thresholdMs", s)}
            />
            <TimingRow
              label={t("app.cooldown")}
              seconds={Math.round(settings.cooldownMs / 1000)}
              onCommit={(s) => setTiming("cooldownMs", s)}
            />
            <TimingRow
              label={t("app.soft_timeout")}
              seconds={Math.round(settings.challengeTimeoutMs / 1000)}
              onCommit={(s) => setTiming("challengeTimeoutMs", s)}
            />

            {Platform.OS === "android" && (
              <Text style={styles.meta}>
                {t("app.usage")}:{" "}
                {permission == null
                  ? "…"
                  : permission
                    ? t("app.ok")
                    : t("app.needed")}
                {" · "}
                {t("app.overlay")}:{" "}
                {overlayPermission == null
                  ? "…"
                  : overlayPermission
                    ? t("app.ok")
                    : t("app.needed")}
              </Text>
            )}

            <Pressable
              style={[styles.button, styles.primary]}
              onPress={() =>
                void (monitoring ? stopMonitoring() : startMonitoring())
              }
            >
              <Text style={styles.buttonLabel}>
                {monitoring ? t("app.stop") : t("app.start")}
              </Text>
            </Pressable>
          </>
        )}
        <StatusBar style={inChallenge ? "light" : "dark"} />
      </ScrollView>
    </LinearGradient>
  );
}

function TimingRow({
  label,
  seconds,
  onCommit,
}: {
  label: string;
  seconds: number;
  onCommit: (text: string) => void;
}) {
  const [text, setText] = useState(String(seconds));
  useEffect(() => {
    setText(String(seconds));
  }, [seconds]);
  return (
    <View style={styles.timingRow}>
      <Text style={styles.timingLabel}>{label}</Text>
      <TextInput
        style={styles.timingInput}
        value={text}
        onChangeText={setText}
        onEndEditing={() => onCommit(text)}
        keyboardType="number-pad"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 48,
    gap: 14,
  },
  brand: {
    fontSize: typography.brandSize,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -1,
  },
  brandOnInk: { color: colors.emberSoft },
  tagline: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.teal,
    textAlign: "center",
    marginTop: -4,
  },
  meta: {
    fontSize: typography.metaSize,
    fontWeight: "400",
    color: colors.textMuted,
    textAlign: "center",
  },
  textOnInk: { color: colors.textOnInk },
  textOnInkMuted: { color: colors.emberSoft },
  copy: {
    fontSize: typography.bodySize,
    fontWeight: "400",
    lineHeight: 24,
    textAlign: "center",
    color: colors.text,
    marginBottom: 4,
    maxWidth: 340,
  },
  section: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    alignSelf: "flex-start",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.chipOff,
  },
  chipOn: { backgroundColor: colors.chipOn },
  chipLabel: { fontWeight: "700", color: colors.ink, fontSize: 14 },
  chipLabelOn: { color: colors.white },
  timingRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  timingLabel: { flex: 1, color: colors.textMuted, fontSize: 13 },
  timingInput: {
    width: 72,
    borderWidth: 1,
    borderColor: colors.chipOff,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: "center",
    color: colors.ink,
    backgroundColor: colors.white,
    fontWeight: "700",
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 240,
    alignItems: "center",
  },
  primary: { backgroundColor: colors.ember },
  buttonLabel: { color: colors.white, fontSize: 16, fontWeight: "700" },
});
