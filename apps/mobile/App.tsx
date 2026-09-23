import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import {
  SessionFsm,
  TypedEventEmitter,
  evaluatePolicy,
  type SessionState,
  type UsageThresholdEvent,
} from "@unloop/core";
import { AndroidUsageDetector } from "./src/androidUsageDetector";
import { MemoryStoragePort } from "./src/memoryStorage";
import { ShakeChallengeView } from "./src/ShakeChallengeView";
import { LocalAuditTrail } from "./src/localAuditTrail";
import UnloopUsage, {
  addOpenChallengeListener,
  type MonitorSnapshot,
} from "./modules/unloop-usage/src/UnloopUsageModule";
import { colors, typography } from "./src/theme";
import {
  COOLDOWN_MS,
  SHORT_VIDEO_APPS,
  THRESHOLD_MS,
  packagesForLabels,
} from "./src/targets";
import { loadSettings, saveSettings } from "./src/settings";

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

export default function App() {
  const storage = useMemo(() => new MemoryStoragePort(), []);
  const audit = useMemo(() => new LocalAuditTrail(storage), [storage]);
  const bus = useMemo(() => new TypedEventEmitter<DomainEvents>(), []);
  const fsm = useMemo(() => new SessionFsm(), []);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sessionState, setSessionState] = useState(fsm.state);
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const [permission, setPermission] = useState<boolean | null>(null);
  const [overlayPermission, setOverlayPermission] = useState<boolean | null>(
    null,
  );
  const [enabledLabels, setEnabledLabels] = useState<string[]>([]);
  const [message, setMessage] = useState(
    "I’m here because you asked me to interrupt autopilot.",
  );

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
          setMessage("Back on watch. You’ve got this.");
        }
      }, wait);
    },
    [clearCooldownTimer, fsm],
  );

  const enterChallengeFromNative = useCallback(
    (deltaU?: number) => {
      if (deltaU != null && deltaU > 0) {
        setLastDelta(deltaU);
      }
      if (fsm.state === "CHALLENGE") {
        setMessage("Pause. Shake to continue — you asked for this.");
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
      setMessage("Pause. Shake to continue — you asked for this.");
    },
    [fsm],
  );

  useEffect(() => {
    void loadSettings().then((s) => setEnabledLabels(s.enabledLabels));
  }, []);

  useEffect(() => {
    return bus.on("CHALLENGE_COMPLETED", (payload) => {
      void audit.append({
        type: "CHALLENGE_COMPLETED",
        atMs: payload.atMs,
        detail: "shake",
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
        setMessage("Pause. Shake to continue — you asked for this.");
      }
    },
    [audit, bus, fsm],
  );

  const detector = useMemo(
    () => new AndroidUsageDetector(onThreshold),
    [onThreshold],
  );

  // syncFromNative closes over detector — redefine dependency by calling after detector exists
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
        setSessionState(fsm.hydrate(target));
        if (target === "CHALLENGE") {
          setMessage("Pause. Shake to continue — you asked for this.");
        } else if (target === "COOLDOWN") {
          scheduleCooldownEnd(snap.cooldownUntilMs);
        }
      }
      if (snap.lastDeltaU > 0) {
        setLastDelta(snap.lastDeltaU);
      }
    }
  }, [detector, fsm, scheduleCooldownEnd]);

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
      if (fsm.state !== target) {
        setSessionState(fsm.hydrate(target));
      }
      if (target === "CHALLENGE") {
        setMessage("Pause. Shake to continue — you asked for this.");
      } else if (target === "COOLDOWN") {
        scheduleCooldownEnd(snap.cooldownUntilMs);
      }
      if (snap.lastDeltaU > 0) {
        setLastDelta(snap.lastDeltaU);
      }
    };
    const sub = AppState.addEventListener("change", onAppState);
    return () => sub.remove();
  }, [detector, fsm, scheduleCooldownEnd]);

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
    const next = enabledLabels.includes(label)
      ? enabledLabels.filter((l) => l !== label)
      : [...enabledLabels, label];
    const safe = next.length === 0 ? [label] : next;
    setEnabledLabels(safe);
    void saveSettings({ enabledLabels: safe });
    if (
      Platform.OS === "android" &&
      (sessionState === "MONITORING" || sessionState === "COOLDOWN")
    ) {
      const packages = packagesForLabels(safe);
      if (packages.length > 0) {
        UnloopUsage.updateMonitoredPackages(packages.join(","));
        setMessage(
          `Watching ${safe.join(", ")}. After ~${THRESHOLD_MS / 1000}s in a feed I’ll interrupt — then ${COOLDOWN_MS / 1000}s of grace.`,
        );
      }
    }
  };

  const startMonitoring = async () => {
    if (Platform.OS !== "android") {
      setMessage("Usage detection is Android-first (Phase 2 for iOS).");
      return;
    }
    if (!detector.hasPermission()) {
      setPermission(false);
      setMessage("Grant Usage Access, then tap Start again.");
      detector.openSettings();
      return;
    }
    setPermission(true);
    if (!detector.hasOverlayPermission()) {
      setOverlayPermission(false);
      setMessage(
        "Allow “Display over other apps” so I can cover the feed when the threshold hits, then Start again.",
      );
      detector.openOverlaySettings();
      return;
    }
    setOverlayPermission(true);
    const packages = packagesForLabels(enabledLabels);
    if (packages.length === 0) {
      setMessage("Pick at least one feed to watch.");
      return;
    }
    if (fsm.state === "PAUSED") {
      setSessionState(fsm.dispatch({ type: "START_MONITORING" }));
    }
    await detector.start({
      appId: packages.join(","),
      thresholdUnits: THRESHOLD_MS,
    });
    setMessage(
      `Watching ${enabledLabels.join(", ")}. After ~${THRESHOLD_MS / 1000}s in a feed I’ll interrupt — then ${COOLDOWN_MS / 1000}s of grace.`,
    );
  };

  const stopMonitoring = async () => {
    clearCooldownTimer();
    await detector.stop();
    UnloopUsage.clearCooldown();
    if (fsm.state !== "PAUSED") {
      setSessionState(fsm.dispatch({ type: "STOP" }));
    }
    setMessage("Monitoring stopped. The feeds are yours again.");
  };

  const completeChallenge = useCallback(() => {
    if (fsm.state !== "CHALLENGE") {
      return;
    }
    UnloopUsage.dismissInterruptOverlay();
    const until = Date.now() + COOLDOWN_MS;
    UnloopUsage.setCooldownUntilMs(until);
    setSessionState(fsm.dispatch({ type: "CHALLENGE_COMPLETED" }));
    bus.emit("CHALLENGE_COMPLETED", { atMs: Date.now() });
    setMessage(
      `Nice. ${COOLDOWN_MS / 1000}s grace — then I’ll watch again if you ask me to.`,
    );
    scheduleCooldownEnd(until);
  }, [bus, fsm, scheduleCooldownEnd]);

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
          Exit the tunnel. You’re the one who asked.
        </Text>
        <Text style={[styles.meta, inChallenge && styles.textOnInkMuted]}>
          {sessionState}
          {lastDelta != null ? ` · last bout ${Math.round(lastDelta / 1000)}s` : ""}
        </Text>

        {!inChallenge && <Text style={styles.copy}>{message}</Text>}
        {inChallenge && <ShakeChallengeView onComplete={completeChallenge} />}

        {!inChallenge && (
          <>
            <Text style={styles.section}>Feeds to interrupt</Text>
            <View style={styles.chips}>
              {SHORT_VIDEO_APPS.map((app) => {
                const on = enabledLabels.includes(app.label);
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

            {Platform.OS === "android" && (
              <Text style={styles.meta}>
                Usage Access:{" "}
                {permission == null ? "…" : permission ? "ok" : "needed"}
                {" · "}
                Overlay:{" "}
                {overlayPermission == null
                  ? "…"
                  : overlayPermission
                    ? "ok"
                    : "needed"}
              </Text>
            )}

            <Pressable
              style={[styles.button, styles.primary]}
              onPress={() => void (monitoring ? stopMonitoring() : startMonitoring())}
            >
              <Text style={styles.buttonLabel}>
                {monitoring ? "Stop watching" : "Start watching"}
              </Text>
            </Pressable>
          </>
        )}
        <StatusBar style={inChallenge ? "light" : "dark"} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
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
  brandOnInk: {
    color: colors.emberSoft,
  },
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
  textOnInk: {
    color: colors.textOnInk,
  },
  textOnInkMuted: {
    color: colors.emberSoft,
  },
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
  chipOn: {
    backgroundColor: colors.chipOn,
  },
  chipLabel: {
    fontWeight: "700",
    color: colors.ink,
    fontSize: 14,
  },
  chipLabelOn: {
    color: colors.white,
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 240,
    alignItems: "center",
  },
  primary: {
    backgroundColor: colors.ember,
  },
  buttonLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
