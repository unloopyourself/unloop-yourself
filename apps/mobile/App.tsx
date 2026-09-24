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
  SessionEngine,
  TypedEventEmitter,
  type Capability,
  type EngineEffect,
  type UsageThresholdEvent,
} from "@unloop/core";
import { AndroidUsageDetector } from "./src/androidUsageDetector";
import { MemoryStoragePort } from "./src/memoryStorage";
import { LocalAuditTrail } from "./src/localAuditTrail";
import UnloopUsage, {
  addOpenChallengeListener,
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

const SENSOR_CAPS: ReadonlySet<Capability> = new Set(["accelerometer"]);

export default function App() {
  const t = useMemo(() => createTranslator(detectLocale()), []);
  const storage = useMemo(() => new MemoryStoragePort(), []);
  const audit = useMemo(() => new LocalAuditTrail(storage), [storage]);
  const bus = useMemo(() => new TypedEventEmitter<DomainEvents>(), []);
  const settingsRef = useRef<UnloopSettings | null>(null);

  const engine = useMemo(
    () =>
      new SessionEngine(
        { now: () => Date.now() },
        { cooldownMs: 120_000, challengeTimeoutMs: 45_000 },
        (enabled, available) => pickChallengeId(enabled, available),
      ),
    [],
  );

  const [sessionState, setSessionState] = useState(engine.state);
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const [permission, setPermission] = useState<boolean | null>(null);
  const [overlayPermission, setOverlayPermission] = useState<boolean | null>(
    null,
  );
  const [settings, setSettings] = useState<UnloopSettings | null>(null);
  const [activeChallengeId, setActiveChallengeId] =
    useState<ChallengeId>("shake");
  const [message, setMessage] = useState(t("app.intro"));

  useEffect(() => {
    settingsRef.current = settings;
    if (settings) {
      engine.setTimings({
        cooldownMs: settings.cooldownMs,
        challengeTimeoutMs: settings.challengeTimeoutMs,
      });
      engine.setChallengeOptions(settings.enabledChallengeIds, SENSOR_CAPS);
    }
  }, [engine, settings]);

  const persist = useCallback((next: UnloopSettings) => {
    setSettings(next);
    void saveSettings(next);
  }, []);

  const applyEffects = useCallback(
    (effects: EngineEffect[]) => {
      setSessionState(engine.state);
      const snap = engine.snapshot();
      if (snap.activeChallengeId) {
        setActiveChallengeId(snap.activeChallengeId as ChallengeId);
      }
      if (snap.lastDeltaU != null) {
        setLastDelta(snap.lastDeltaU);
      }

      for (const effect of effects) {
        switch (effect.type) {
          case "enter_challenge":
            setActiveChallengeId(effect.challengeId as ChallengeId);
            setLastDelta(effect.deltaU);
            setMessage(t("app.interrupt"));
            bus.emit("THRESHOLD_REACHED", {
              appId: effect.appId,
              deltaU: effect.deltaU,
            });
            break;
          case "cooldown_started":
            UnloopUsage.dismissInterruptOverlay();
            UnloopUsage.setCooldownUntilMs(effect.untilMs);
            setMessage(
              effect.reason === "completed"
                ? t("app.challenge_ok", {
                    cooldown: Math.round(
                      (settingsRef.current?.cooldownMs ?? 120_000) / 1000,
                    ),
                  })
                : t("app.soft_fail"),
            );
            break;
          case "cooldown_elapsed":
            UnloopUsage.clearCooldown();
            setMessage(t("app.back_on_watch"));
            break;
          case "monitoring_started":
            break;
          case "paused":
            UnloopUsage.clearCooldown();
            break;
          default:
            break;
        }
      }
    },
    [bus, engine, t],
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

  // Drive soft-unlock / cooldown timers from the same engine tests use.
  useEffect(() => {
    const id = setInterval(() => {
      const effects = engine.tick();
      if (effects.length > 0) {
        applyEffects(effects);
      }
    }, 500);
    return () => clearInterval(id);
  }, [applyEffects, engine]);

  const onThreshold = useCallback(
    (event: UsageThresholdEvent) => {
      const effects = engine.onThresholdReached(event.appId, event.deltaU);
      if (effects.length === 0) {
        return;
      }
      void audit.append({
        type: "THRESHOLD_REACHED",
        atMs: event.observedAtMs,
        detail: event.appId,
      });
      applyEffects(effects);
    },
    [applyEffects, audit, engine],
  );

  const detector = useMemo(
    () => new AndroidUsageDetector(onThreshold),
    [onThreshold],
  );

  const syncFromNative = useCallback(() => {
    if (Platform.OS !== "android") {
      return;
    }
    const snap = UnloopUsage.getMonitorSnapshot();
    if (!snap.monitoring && engine.state === "PAUSED") {
      return;
    }
    detector.ensureListening();
    const effects = engine.hydrate({
      monitoring: snap.monitoring,
      challengeOutstanding: snap.challengeOutstanding,
      inCooldown: snap.inCooldown,
      cooldownUntilMs: snap.cooldownUntilMs,
    });
    if (snap.lastDeltaU > 0) {
      setLastDelta(snap.lastDeltaU);
    }
    applyEffects(effects);
  }, [applyEffects, detector, engine]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    setPermission(detector.hasPermission());
    setOverlayPermission(detector.hasOverlayPermission());
    syncFromNative();
  }, [detector, syncFromNative]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        syncFromNative();
      }
    });
    return () => sub.remove();
  }, [syncFromNative]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    const sub = addOpenChallengeListener(() => {
      syncFromNative();
      if (engine.state === "MONITORING") {
        const snap = UnloopUsage.getMonitorSnapshot();
        applyEffects(
          engine.onThresholdReached(
            snap.lastAppId || "unknown",
            snap.lastDeltaU || 0,
          ),
        );
      } else if (engine.state !== "CHALLENGE") {
        applyEffects(
          engine.hydrate({
            monitoring: true,
            challengeOutstanding: true,
            inCooldown: false,
          }),
        );
      } else {
        setMessage(t("app.interrupt"));
      }
    });
    return () => sub.remove();
  }, [applyEffects, engine, syncFromNative, t]);

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
    persist({ ...settings, [key]: Math.round(sec * 1000) });
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
    applyEffects(engine.startMonitoring());
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
    await detector.stop();
    applyEffects(engine.stop());
    setMessage(t("app.stopped"));
  };

  const completeChallenge = useCallback(() => {
    const effects = engine.onChallengeCompleted();
    if (effects.length > 0) {
      bus.emit("CHALLENGE_COMPLETED", { atMs: Date.now() });
      applyEffects(effects);
    }
  }, [applyEffects, bus, engine]);

  const softFailChallenge = useCallback(() => {
    applyEffects(engine.onChallengeSoftFail());
  }, [applyEffects, engine]);

  const inChallenge = sessionState === "CHALLENGE";
  const monitoring =
    sessionState === "MONITORING" || sessionState === "COOLDOWN";

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
