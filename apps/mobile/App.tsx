import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Platform,
  StyleSheet,
  Text,
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
import { packagesForLabels } from "./src/targets";
import { loadSettings, saveSettings, type UnloopSettings } from "./src/settings";
import { createTranslator, detectLocale } from "./src/i18n";
import { pickChallengeId, type ChallengeId } from "./src/challenges/registry";
import { ChallengeHost } from "./src/challenges/ChallengeHost";
import { ExpoSensorPort } from "./src/expoSensorPort";
import { HomeScreen } from "./src/screens/HomeScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { AboutScreen } from "./src/screens/AboutScreen";
import { MenuSheet } from "./src/screens/MenuSheet";

type DomainEvents = {
  CHALLENGE_COMPLETED: { atMs: number };
  THRESHOLD_REACHED: { appId: string; deltaU: number };
};

type AppScreen = "home" | "settings" | "about";

export default function App() {
  const t = useMemo(() => createTranslator(detectLocale()), []);
  const storage = useMemo(() => new MemoryStoragePort(), []);
  const audit = useMemo(() => new LocalAuditTrail(storage), [storage]);
  const bus = useMemo(() => new TypedEventEmitter<DomainEvents>(), []);
  const settingsRef = useRef<UnloopSettings | null>(null);
  const sensorPort = useMemo(() => new ExpoSensorPort(), []);
  const [deviceCaps, setDeviceCaps] = useState<ReadonlySet<Capability>>(
    () => new Set(),
  );

  const engine = useMemo(
    () =>
      new SessionEngine(
        { now: () => Date.now() },
        { cooldownMs: 120_000, challengeTimeoutMs: 45_000 },
        (enabled, available, excludeId) => {
          if (Platform.OS === "android") {
            const forced = UnloopUsage.getHarnessForceChallengeId();
            if (forced) {
              return forced;
            }
          }
          return pickChallengeId(enabled, available, excludeId);
        },
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
  const [screen, setScreen] = useState<AppScreen>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    settingsRef.current = settings;
    if (settings) {
      engine.setTimings({
        cooldownMs: settings.cooldownMs,
        challengeTimeoutMs: settings.challengeTimeoutMs,
      });
      engine.setChallengeOptions(settings.enabledChallengeIds, deviceCaps);
    }
  }, [engine, settings, deviceCaps]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = new Set<Capability>();
      if (Platform.OS === "android") {
        const override = UnloopUsage.getHarnessCapabilitiesOverride();
        if (override !== null && override !== undefined) {
          for (const part of override.split(",")) {
            const id = part.trim();
            if (id === "accelerometer" || id === "gyroscope") {
              next.add(id);
            }
          }
          if (!cancelled) {
            setDeviceCaps(next);
            UnloopUsage.logHarness(
              `capabilities:${[...next].join(",") || "none"}`,
            );
          }
          return;
        }
      }
      if (await sensorPort.isAvailable("accelerometer")) {
        next.add("accelerometer");
      }
      if (await sensorPort.isAvailable("gyroscope")) {
        next.add("gyroscope");
      }
      if (!cancelled) {
        setDeviceCaps(next);
        if (Platform.OS === "android") {
          UnloopUsage.logHarness(
            `capabilities:${[...next].join(",") || "none"}`,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sensorPort]);

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
            if (Platform.OS === "android") {
              UnloopUsage.logHarness(`enter_challenge:${effect.challengeId}`);
            }
            bus.emit("THRESHOLD_REACHED", {
              appId: effect.appId,
              deltaU: effect.deltaU,
            });
            break;
          case "cooldown_started":
            UnloopUsage.dismissInterruptOverlay();
            UnloopUsage.setCooldownUntilMs(effect.untilMs);
            if (Platform.OS === "android") {
              UnloopUsage.logHarness(`cooldown_${effect.reason}`);
            }
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

  const permissionLabel =
    Platform.OS === "android"
      ? `${t("app.usage")}: ${
          permission == null
            ? "…"
            : permission
              ? t("app.ok")
              : t("app.needed")
        } · ${t("app.overlay")}: ${
          overlayPermission == null
            ? "…"
            : overlayPermission
              ? t("app.ok")
              : t("app.needed")
        }`
      : null;

  return (
    <LinearGradient
      colors={
        inChallenge
          ? [colors.ink, colors.inkSoft]
          : [colors.mist, colors.mistEnd]
      }
      style={styles.gradient}
    >
      {inChallenge && settings ? (
        <ScrollView
          contentContainerStyle={styles.challengeContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brandOnInk}>Unloop</Text>
          <Text style={styles.taglineOnInk}>{t("app.tagline")}</Text>
          <ChallengeHost
            challengeId={activeChallengeId}
            timeoutMs={settings.challengeTimeoutMs}
            t={t}
            onComplete={completeChallenge}
            onSoftFail={softFailChallenge}
          />
        </ScrollView>
      ) : screen === "settings" && settings ? (
        <SettingsScreen
          t={t}
          settings={settings}
          deviceCaps={deviceCaps}
          permission={permission}
          overlayPermission={overlayPermission}
          onBack={() => setScreen("home")}
          onToggleLabel={toggleLabel}
          onToggleChallenge={toggleChallenge}
          onSetTiming={setTiming}
        />
      ) : screen === "about" ? (
        <AboutScreen t={t} onBack={() => setScreen("home")} />
      ) : (
        <HomeScreen
          t={t}
          sessionState={sessionState}
          lastDelta={lastDelta}
          message={message}
          monitoring={monitoring}
          permissionLabel={permissionLabel}
          onToggleMonitoring={() =>
            void (monitoring ? stopMonitoring() : startMonitoring())
          }
          onOpenMenu={() => setMenuOpen(true)}
        />
      )}

      <MenuSheet
        visible={menuOpen && !inChallenge}
        t={t}
        onClose={() => setMenuOpen(false)}
        onOpenSettings={() => setScreen("settings")}
        onOpenAbout={() => setScreen("about")}
      />
      <StatusBar style={inChallenge ? "light" : "dark"} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  challengeContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 48,
    gap: 14,
  },
  brandOnInk: {
    fontSize: typography.brandSize,
    fontWeight: "800",
    color: colors.emberSoft,
    letterSpacing: -1,
  },
  taglineOnInk: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textOnInk,
    textAlign: "center",
    marginTop: -4,
  },
});
