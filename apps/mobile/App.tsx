import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  CORE_PACKAGE_NAME,
  SessionFsm,
  evaluatePolicy,
  type UsageThresholdEvent,
} from "@unloop/core";
import { AndroidUsageDetector } from "./src/androidUsageDetector";
import { MemoryStoragePort } from "./src/memoryStorage";

/** Debug default: YouTube package; change in-app later. Threshold 1 minute of ΔU. */
const DEBUG_TARGET_PACKAGE = "com.google.android.youtube";
const DEBUG_THRESHOLD_MS = 60_000;

export default function App() {
  const storage = useMemo(() => new MemoryStoragePort(), []);
  const fsm = useMemo(() => new SessionFsm(), []);
  const [sessionState, setSessionState] = useState(fsm.state);
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const [permission, setPermission] = useState<boolean | null>(null);
  const [message, setMessage] = useState("Scaffold ready.");

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
        setMessage("Threshold reached — challenge UI comes in P1-05/P1-06.");
      }
    },
    [fsm],
  );

  const detector = useMemo(
    () => new AndroidUsageDetector(storage, onThreshold),
    [storage, onThreshold],
  );

  useEffect(() => {
    if (Platform.OS === "android") {
      setPermission(detector.hasPermission());
    }
  }, [detector]);

  const startMonitoring = async () => {
    if (Platform.OS !== "android") {
      setMessage("Usage detection is Android-first (see roadmap Phase 2 for iOS).");
      return;
    }
    if (!detector.hasPermission()) {
      setPermission(false);
      setMessage("Grant Usage Access, then tap Start again.");
      detector.openSettings();
      return;
    }
    setPermission(true);
    if (fsm.state === "PAUSED") {
      setSessionState(fsm.dispatch({ type: "START_MONITORING" }));
    }
    await detector.start({
      appId: DEBUG_TARGET_PACKAGE,
      thresholdUnits: DEBUG_THRESHOLD_MS,
    });
    setMessage(`Monitoring ${DEBUG_TARGET_PACKAGE} (ΔU ≥ ${DEBUG_THRESHOLD_MS} ms).`);
  };

  const stopMonitoring = async () => {
    await detector.stop();
    if (fsm.state !== "PAUSED") {
      setSessionState(fsm.dispatch({ type: "STOP" }));
    }
    setMessage("Monitoring stopped.");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Unloop</Text>
      <Text style={styles.meta}>
        {CORE_PACKAGE_NAME} · {sessionState}
        {lastDelta != null ? ` · ΔU ${Math.round(lastDelta / 1000)}s` : ""}
      </Text>
      <Text style={styles.copy}>{message}</Text>
      {Platform.OS === "android" && (
        <Text style={styles.meta}>
          Usage Access: {permission == null ? "…" : permission ? "granted" : "needed"}
        </Text>
      )}
      <Pressable style={styles.button} onPress={() => void startMonitoring()}>
        <Text style={styles.buttonLabel}>Start monitoring</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.secondary]} onPress={() => void stopMonitoring()}>
        <Text style={styles.buttonLabel}>Stop</Text>
      </Pressable>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f7f5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  brand: {
    fontSize: 36,
    fontWeight: "700",
    color: "#1a3c34",
  },
  meta: {
    fontSize: 14,
    color: "#4a635c",
    textAlign: "center",
  },
  copy: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: "#24352f",
    marginBottom: 8,
  },
  button: {
    backgroundColor: "#1a3c34",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 220,
    alignItems: "center",
  },
  secondary: {
    backgroundColor: "#4a635c",
  },
  buttonLabel: {
    color: "#f4f7f5",
    fontSize: 16,
    fontWeight: "600",
  },
});
