import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import {
  isPastLockout,
  NudgeBus,
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
  addSoftSkipChallengeListener,
} from "./modules/unloop-usage/src/UnloopUsageModule";
import { colors, typography } from "./src/theme";
import {
  CHALLENGE_TIMEOUT_MS,
  COOLDOWN_MS,
  packagesForLabels,
} from "./src/targets";
import { loadSettings, saveSettings, type UnloopSettings } from "./src/settings";
import { createTranslator, detectLocale } from "./src/i18n";
import {
  pickChallengeId,
  HIDDEN_CHALLENGE_IDS,
  type ChallengeId,
} from "./src/challenges/registry";
import { ChallengeHost } from "./src/challenges/ChallengeHost";
import { ExpoSensorPort } from "./src/expoSensorPort";
import * as Linking from "expo-linking";
import { HomeScreen } from "./src/screens/HomeScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { AboutScreen } from "./src/screens/AboutScreen";
import * as Notifications from "expo-notifications";
import { BuddyScreen } from "./src/screens/BuddyScreen";
import { BuddyComposeScreen } from "./src/screens/BuddyComposeScreen";
import { BuddyNudgeView } from "./src/screens/BuddyNudgeView";
import { MenuSheet } from "./src/screens/MenuSheet";
import {
  anyBuddyAcceptsNudges,
  loadBuddies,
  loadOrCreateIdentity,
} from "./src/buddyStore";
import {
  allowApproachingPush,
  buildAutoSendCipher,
  claimAutoSendEvent,
  decodeNudgeBlob,
  loadPendingApproach,
  setPendingApproach,
  type PendingApproach,
} from "./src/buddyNudgeStore";
import { isSoundPresetId } from "./src/buddySoundPresets";
import type { SoundPresetId } from "@unloop/core";
import { isInQuietHours } from "./src/buddySettings";
import {
  ExpoPushPort,
  getRelayBaseUrl,
  registerPushTokenWithRelay,
} from "./src/push/expoPushPort";
import { HttpRelayPort } from "./src/push/httpRelayPort";
import {
  effectiveBuddyWarnLeadMs,
  readNativeBuddyEventId,
  syncBuddyApproachingNative,
} from "./src/buddyApproachingNative";
import { MIN_BUDDY_WARN_LEAD_MS } from "./src/buddySettings";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type DomainEvents = {
  CHALLENGE_COMPLETED: { atMs: number };
  THRESHOLD_REACHED: { appId: string; deltaU: number };
};

type AppScreen = "home" | "settings" | "about" | "buddy" | "buddyCompose";

function isPairDeepLink(url: string): boolean {
  return /unloop:\/\/pair/i.test(url) || /[?&#]p=/.test(url);
}

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
        { cooldownMs: COOLDOWN_MS, challengeTimeoutMs: CHALLENGE_TIMEOUT_MS },
        (enabled, available, excludeId) => {
          if (Platform.OS === "android") {
            const forced = UnloopUsage.getHarnessForceChallengeId()?.trim();
            // Only honor an explicit non-empty harness override (AVD/debug).
            if (forced) {
              UnloopUsage.logHarness(`forceChallenge:${forced}`);
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
    useState<ChallengeId>("breath_tap");
  const [message, setMessage] = useState(t("app.intro"));
  const [screen, setScreen] = useState<AppScreen>("home");
  const [pendingPairInvite, setPendingPairInvite] = useState<string | null>(
    null,
  );
  const [pendingApproach, setPendingApproachState] =
    useState<PendingApproach | null>(null);
  const [buddyNudgeText, setBuddyNudgeText] = useState<string | null>(null);
  const [buddyNudgePresetId, setBuddyNudgePresetId] =
    useState<SoundPresetId | null>(null);
  const [buddyNudgeMedia, setBuddyNudgeMedia] = useState<{
    mime: string;
    data: string;
  } | null>(null);
  const [buddyNudgeDismissed, setBuddyNudgeDismissed] = useState(false);
  /** Buddy tapped the approaching tray — keep live compose open past lockout. */
  const [liveComposeHold, setLiveComposeHold] = useState(false);
  const buddyNudgeTextRef = useRef<string | null>(null);

  const applyDecodedBuddyNudge = useCallback(
    (decoded: NonNullable<ReturnType<typeof decodeNudgeBlob>>) => {
      const body = decoded.body?.trim() ? decoded.body : null;
      if (body) {
        buddyNudgeTextRef.current = body;
        setBuddyNudgeText(body);
      } else if (decoded.presetId || decoded.media) {
        // Media/preset-only: still mark presence for the dedicated nudge surface.
        const fallback =
          decoded.presetId || decoded.kind || decoded.media?.mime || "nudge";
        buddyNudgeTextRef.current = fallback;
        setBuddyNudgeText(fallback);
      }
      setBuddyNudgePresetId(
        decoded.presetId && isSoundPresetId(decoded.presetId)
          ? decoded.presetId
          : null,
      );
      setBuddyNudgeMedia(decoded.media ?? null);
      setBuddyNudgeDismissed(false);
    },
    [],
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [buddyReturnScreen, setBuddyReturnScreen] =
    useState<AppScreen>("home");
  const nudgeBusRef = useRef<NudgeBus | null>(null);
  /** Remount ChallengeHost when the user taps Open (fresh sensors + timeout). */
  const [challengeMountKey, setChallengeMountKey] = useState(0);
  /**
   * Challenge UI (tone/sensors) stays off until Open challenge — otherwise
   * enter_challenge under the overlay starts audio/sensors too early.
   */
  const [challengeOpened, setChallengeOpened] = useState(false);
  const pendingOpenRef = useRef(false);
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

  const persist = useCallback(
    (next: UnloopSettings) => {
      // Buddy approaching needs ≥2 min lead before threshold — bump threshold
      // when Buddy is on and the limit is shorter than the warn lead.
      let saved = next;
      if (saved.buddyEnabled) {
        const need = Math.max(MIN_BUDDY_WARN_LEAD_MS, saved.buddyWarnLeadMs);
        if (saved.thresholdMs < need) {
          saved = { ...saved, thresholdMs: need };
        }
      }
      // Sync ref + engine immediately so a threshold that fires while Settings
      // is open (or before React effects flush) sees the new challenge list /
      // timings — not the previous selection.
      settingsRef.current = saved;
      engine.setTimings({
        cooldownMs: saved.cooldownMs,
        challengeTimeoutMs: saved.challengeTimeoutMs,
      });
      engine.setChallengeOptions(saved.enabledChallengeIds, deviceCaps);
      setSettings(saved);
      void saveSettings(saved);
      void syncBuddyApproachingNative(saved);
      // Keep native FGS on Settings timings (harness / sticky resume can drift).
      if (Platform.OS === "android") {
        try {
          const snap = UnloopUsage.getMonitorSnapshot();
          if (snap.monitoring) {
            UnloopUsage.updateNativeThreshold(saved.thresholdMs);
          }
        } catch {
          /* optional */
        }
      }
    },
    [deviceCaps, engine],
  );

  const rearmBuddyNudgeBus = useCallback(async () => {
    const s = settingsRef.current;
    nudgeBusRef.current = null;
    if (!s?.buddyEnabled) return;
    try {
      await syncBuddyApproachingNative(s);
      const identity = await loadOrCreateIdentity();
      const buddies = await loadBuddies();
      const relayUrl = getRelayBaseUrl();
      if (!relayUrl || buddies.length === 0) return;
      const relay = new HttpRelayPort(relayUrl);
      const busLive = new NudgeBus(relay, { now: () => Date.now() });
      const now = Date.now();
      // Prefer native bout eventId so mailbox put (Buddy) matches seeker fetch.
      const nativeEventId = readNativeBuddyEventId();
      busLive.begin({
        mailboxId: identity.mailboxId,
        // Soft wall-clock fallback only; approaching is usage-driven.
        interruptAtMs: now + s.thresholdMs,
        warnLeadMs: effectiveBuddyWarnLeadMs(s),
        ...(nativeEventId ? { eventId: nativeEventId } : {}),
      });
      const nativeState =
        Platform.OS === "android"
          ? UnloopUsage.getBuddyApproachingState()
          : null;
      const sess = busLive.active;
      if (nativeState?.approachingSent && sess) {
        // Native already POSTed notify while JS was paused — do not re-fire.
        sess.approachingSent = true;
      }
      nudgeBusRef.current = busLive;
    } catch {
      nudgeBusRef.current = null;
    }
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
            setBuddyNudgeDismissed(false);
            // Keep Open if already true (race with overlay Start). If Unloop is
            // already foreground and the overlay is not covering, mount now —
            // otherwise the in-app shield had no buttons and felt stuck.
            setChallengeOpened((wasOpen) => {
              if (wasOpen) return true;
              if (AppState.currentState !== "active") return false;
              if (Platform.OS !== "android") return true;
              try {
                const snap = UnloopUsage.getMonitorSnapshot();
                return snap.overlayShowing !== true;
              } catch {
                return true;
              }
            });
            void (async () => {
              const buddies = await loadBuddies();
              if (!anyBuddyAcceptsNudges(buddies)) return;
              const blob = await nudgeBusRef.current?.fetchNudge();
              if (!blob) return;
              const decoded = decodeNudgeBlob(blob);
              if (decoded) applyDecodedBuddyNudge(decoded);
            })();
            if (Platform.OS === "android") {
              UnloopUsage.stopChallengeTone();
              UnloopUsage.logHarness(`enter_challenge:${effect.challengeId}`);
            }
            bus.emit("THRESHOLD_REACHED", {
              appId: effect.appId,
              deltaU: effect.deltaU,
            });
            break;
          case "cooldown_started":
            setChallengeOpened(false);
            UnloopUsage.dismissInterruptOverlay();
            UnloopUsage.setCooldownUntilMs(effect.untilMs);
            if (Platform.OS === "android") {
              UnloopUsage.logHarness(`cooldown_${effect.reason}`);
            }
            // Next feed bout needs a fresh approaching window.
            void rearmBuddyNudgeBus();
            setMessage(
              effect.reason === "completed"
                ? t("app.challenge_ok", {
                    cooldown: Math.round(
                      (settingsRef.current?.cooldownMs ?? COOLDOWN_MS) / 60_000,
                    ),
                  })
                : effect.reason === "soft_fail"
                  ? t("app.soft_fail")
                  : t("app.cooldown_restored", {
                      cooldown: Math.max(
                        1,
                        Math.round(
                          (effect.untilMs - Date.now()) / 60_000,
                        ),
                      ),
                    }),
            );
            break;
          case "cooldown_elapsed":
            UnloopUsage.clearCooldown();
            setMessage(t("app.back_on_watch"));
            break;
          case "monitoring_started": {
            const s = settingsRef.current;
            if (s) {
              setMessage(
                t("app.watching", {
                  feeds: s.enabledLabels.join(", "),
                  threshold: Math.round(s.thresholdMs / 60_000),
                  cooldown: Math.round(s.cooldownMs / 60_000),
                }),
              );
            }
            break;
          }
          case "paused":
            UnloopUsage.clearCooldown();
            break;
          default:
            break;
        }
      }
    },
    [applyDecodedBuddyNudge, bus, engine, rearmBuddyNudgeBus, t],
  );

  useEffect(() => {
    void loadSettings().then((s) => {
      let next = s;
      if (next.buddyEnabled) {
        const need = Math.max(MIN_BUDDY_WARN_LEAD_MS, next.buddyWarnLeadMs);
        if (next.thresholdMs < need || next.buddyWarnLeadMs < MIN_BUDDY_WARN_LEAD_MS) {
          next = {
            ...next,
            buddyWarnLeadMs: Math.max(
              MIN_BUDDY_WARN_LEAD_MS,
              next.buddyWarnLeadMs,
            ),
            thresholdMs: Math.max(need, next.thresholdMs),
          };
          void saveSettings(next);
        }
      }
      setSettings(next);
      settingsRef.current = next;
      void syncBuddyApproachingNative(next);
    });
  }, []);

  useEffect(() => {
    const openPair = (url: string | null) => {
      if (!url || !isPairDeepLink(url)) return;
      setPendingPairInvite(url);
      setBuddyReturnScreen("home");
      setScreen("buddy");
      setMenuOpen(false);
    };
    void Linking.getInitialURL().then(openPair);
    const sub = Linking.addEventListener("url", ({ url }) => openPair(url));
    return () => sub.remove();
  }, []);

  // Best-effort FCM token → relay (no Analytics SDK). Needs a device build with google-services.json.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    let cancelled = false;
    void (async () => {
      try {
        const identity = await loadOrCreateIdentity();
        const token = await new ExpoPushPort().getToken();
        if (cancelled || !token) return;
        const relay = getRelayBaseUrl();
        if (!relay) return;
        await registerPushTokenWithRelay(relay, identity.mailboxId, token);
      } catch {
        // Push is optional until Buddy live path is on.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lastApproachEventIdRef = useRef<string | null>(null);

  const silentAutoSendStaged = useCallback(
    async (pending: PendingApproach, opts?: { requireEmptyMailbox?: boolean }) => {
      const s = settingsRef.current;
      if (!s?.buddyAutoSendStaged) return;
      const relayUrl = getRelayBaseUrl();
      if (!relayUrl) return;
      const relay = new HttpRelayPort(relayUrl);
      try {
        if (opts?.requireEmptyMailbox !== false) {
          const existing = await relay.getMailbox(
            pending.mailboxId,
            pending.eventId,
          );
          if (existing) return;
        }
        if (!(await claimAutoSendEvent(pending.eventId))) return;
        const cipher = await buildAutoSendCipher(s.buddyDefaultNudge);
        if (!cipher) return;
        await relay.putMailbox(
          pending.mailboxId,
          pending.eventId,
          cipher,
          180,
        );
        if (Platform.OS === "android") {
          UnloopUsage.logHarness(`buddy_autosend:${pending.eventId}`);
        }
      } catch {
        /* best-effort — do not surface UI in quiet hours */
      }
    },
    [],
  );

  const openApproachCompose = useCallback(
    async (
      pending: PendingApproach,
      opts?: { force?: boolean; fromUserTap?: boolean },
    ) => {
      const s = settingsRef.current;
      const fromTap = opts?.fromUserTap === true;
      const force = opts?.force === true || fromTap;
      // Quiet hours: mute UI; optional silent staged auto-send (no notify cap).
      // Explicit notification tap still opens live compose so the buddy can act.
      if (s?.buddyQuietHoursEnabled && !fromTap) {
        const hour = new Date().getHours();
        if (
          isInQuietHours(hour, s.buddyQuietStartHour, s.buddyQuietEndHour)
        ) {
          if (s.buddyAutoSendStaged) {
            void silentAutoSendStaged(pending, { requireEmptyMailbox: true });
          }
          return;
        }
      }
      // In-memory dedupe before touching the hourly log (FCM can fan out twice).
      // User tap always re-opens the live compose mask.
      if (!force && lastApproachEventIdRef.current === pending.eventId) {
        return;
      }
      if (
        !force &&
        s &&
        !(await allowApproachingPush(
          s.buddyMaxPushPerHour,
          Date.now(),
          pending.eventId,
        ))
      ) {
        return;
      }
      lastApproachEventIdRef.current = pending.eventId;
      if (fromTap) {
        setLiveComposeHold(true);
      }
      await setPendingApproach(pending);
      setPendingApproachState(pending);
      setScreen("buddyCompose");
      setMenuOpen(false);
      if (Platform.OS === "android") {
        UnloopUsage.logHarness(
          `buddy_compose_open:${pending.eventId}:${fromTap ? "tap" : "push"}`,
        );
      }
      // Local banner only for silent/background receive — not when user already tapped.
      if (!fromTap) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: t("buddy.approaching_title"),
              body: t("buddy.approaching_body"),
              data: {
                type: "approaching",
                eventId: pending.eventId,
                mailboxId: pending.mailboxId,
                ...(pending.interruptAtMs != null
                  ? { interruptAtMs: String(pending.interruptAtMs) }
                  : {}),
              },
            },
            trigger: null,
          });
        } catch {
          /* banner optional */
        }
      }
    },
    [silentAutoSendStaged, t],
  );

  // FCM / local notification → Buddy compose (approaching).
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const pendingFromData = (
      data: Record<string, unknown> | undefined | null,
    ): PendingApproach | null => {
      if (!data || typeof data !== "object") return null;
      const type = String(data.type ?? "");
      const eventId = String(data.eventId ?? "");
      const mailboxId = String(data.mailboxId ?? "");
      // FCM data is stringly; require ids. type may be missing on some OEM taps.
      if (!eventId || !mailboxId) return null;
      if (type && type !== "approaching") return null;
      const interruptRaw = data.interruptAtMs;
      const interruptAtMs =
        typeof interruptRaw === "number"
          ? interruptRaw
          : typeof interruptRaw === "string"
            ? Number(interruptRaw)
            : NaN;
      return {
        eventId,
        mailboxId,
        receivedAtMs: Date.now(),
        ...(Number.isFinite(interruptAtMs) ? { interruptAtMs } : {}),
      };
    };

    const handledResponseIds = new Set<string>();
    const openFromNotificationData = (
      data: Record<string, unknown> | undefined | null,
      fromUserTap: boolean,
      responseKey?: string,
    ) => {
      if (responseKey) {
        if (handledResponseIds.has(responseKey)) return;
        handledResponseIds.add(responseKey);
      }
      const pending = pendingFromData(data);
      if (!pending) return;
      void openApproachCompose(pending, {
        fromUserTap,
        force: fromUserTap,
      });
    };

    void (async () => {
      const stored = await loadPendingApproach();
      if (stored) {
        lastApproachEventIdRef.current = stored.eventId;
        setPendingApproachState(stored);
      }
      // Cold start: user tapped the tray notification while the app was killed.
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) {
          openFromNotificationData(
            last.notification.request.content.data as
              | Record<string, unknown>
              | undefined,
            true,
            `cold:${last.notification.request.identifier}`,
          );
        }
      } catch {
        /* optional */
      }
    })();

    const subRecv = Notifications.addNotificationReceivedListener((n) => {
      openFromNotificationData(
        n.request.content.data as Record<string, unknown>,
        false,
      );
    });
    const subResp = Notifications.addNotificationResponseReceivedListener(
      (r) => {
        openFromNotificationData(
          r.notification.request.content.data as Record<string, unknown>,
          true,
          `resp:${r.notification.request.identifier}`,
        );
      },
    );
    return () => {
      subRecv.remove();
      subResp.remove();
    };
  }, [openApproachCompose]);

  // P3.5-09: lockout ~T−lockoutLead — dismiss live compose; optional staged PUT.
  // If the buddy opened compose from a notification tap, keep the live mask
  // open (still best-effort autosend into an empty mailbox).
  useEffect(() => {
    if (!pendingApproach) return;
    const s0 = settingsRef.current;
    const interruptAtMs =
      pendingApproach.interruptAtMs ??
      pendingApproach.receivedAtMs + (s0?.buddyWarnLeadMs ?? 120_000);
    const eventId = pendingApproach.eventId;
    const mailboxId = pendingApproach.mailboxId;
    let fired = false;
    const id = setInterval(() => {
      const s = settingsRef.current;
      const lead = s?.buddyLockoutLeadMs ?? 30_000;
      if (!isPastLockout(Date.now(), interruptAtMs, lead)) return;
      if (fired) return;
      fired = true;
      void (async () => {
        // T−lockout: staged prereg into empty mailbox + clear tray.
        if (s?.buddyAutoSendStaged) {
          await silentAutoSendStaged(
            { eventId, mailboxId, receivedAtMs: Date.now(), interruptAtMs },
            { requireEmptyMailbox: true },
          );
        }
        try {
          await Notifications.dismissAllNotificationsAsync();
        } catch {
          /* optional */
        }
        if (liveComposeHold) {
          // User opened compose from tap — keep the live mask; tray is gone.
          return;
        }
        await setPendingApproach(null);
        setPendingApproachState(null);
        setScreen((prev) => (prev === "buddyCompose" ? "home" : prev));
      })();
    }, 500);
    return () => clearInterval(id);
  }, [pendingApproach, silentAutoSendStaged, liveComposeHold]);

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
  // Also tick NudgeBus → approaching push to paired buddies / interrupt fetch.
  useEffect(() => {
    const id = setInterval(() => {
      const effects = engine.tick();
      if (effects.length > 0) {
        applyEffects(effects);
      }
      const nb = nudgeBusRef.current;
      if (!nb) return;
      const sTick = settingsRef.current;
      // Native FGS owns approaching HTTP (JS timers pause in background). Keep
      // NudgeBus eventId aligned with the native bout for mailbox fetch.
      if (Platform.OS === "android" && sTick?.buddyEnabled) {
        try {
          const nativeId = readNativeBuddyEventId();
          const sess = nb.active;
          if (nativeId && sess && sess.eventId !== nativeId) {
            void rearmBuddyNudgeBus();
            return;
          }
          const nativeState = UnloopUsage.getBuddyApproachingState();
          if (nativeState.approachingSent && sess && !sess.approachingSent) {
            sess.approachingSent = true;
          }
        } catch {
          /* optional */
        }
      }
      let intents = nb.tick();
      if (Platform.OS === "android" && sTick?.buddyEnabled) {
        try {
          const snap = UnloopUsage.getMonitorSnapshot();
          intents = [
            ...nb.observeUsage({
              accumulatedMs: snap.accumulatedMs ?? 0,
              thresholdMs: sTick.thresholdMs,
              warnLeadMs: effectiveBuddyWarnLeadMs(sTick),
              inTargetFeed: snap.inTargetFeed === true,
            }),
            ...intents,
          ];
        } catch {
          /* snapshot optional */
        }
      }
      for (const intent of intents) {
        if (intent.type === "approaching") {
          // Native UsageMonitorService POSTs /v1/notify; JS only logs + latch.
          console.log(
            `buddy_approaching:${intent.eventId}:${intent.mailboxId}`,
          );
          if (Platform.OS === "android") {
            UnloopUsage.logHarness(
              `buddy_approaching:${intent.eventId}:${intent.mailboxId}`,
            );
          }
        }
        if (intent.type === "interrupt_fetch") {
          void (async () => {
            const buddies = await loadBuddies();
            if (!anyBuddyAcceptsNudges(buddies)) return;
            const blob = await nb.fetchNudge();
            if (!blob) return;
            const decoded = decodeNudgeBlob(blob);
            if (decoded) applyDecodedBuddyNudge(decoded);
            void audit.append({
              type: "BUDDY_NUDGE_FETCHED",
              atMs: Date.now(),
              detail: intent.eventId,
            });
          })();
        }
      }
    }, 500);
    return () => clearInterval(id);
  }, [applyEffects, audit, engine, rearmBuddyNudgeBus]);

  const onThreshold = useCallback(
    (event: UsageThresholdEvent) => {
      if (!settingsRef.current) {
        // Settings not hydrated yet — avoid picking engine defaults (was forcing shake).
        pendingOpenRef.current = true;
        return;
      }
      engine.setChallengeOptions(
        settingsRef.current.enabledChallengeIds,
        deviceCaps,
      );
      const effects = engine.onThresholdReached(event.appId, event.deltaU);
      if (effects.length === 0) {
        return;
      }
      void audit.append({
        type: "THRESHOLD_REACHED",
        atMs: event.observedAtMs,
        detail: event.appId,
      });
      // Fetch Buddy mailbox BEFORE entering challenge UI so the nudge is the
      // first surface (not under / after the challenge chrome).
      void (async () => {
        try {
          const buddies = await loadBuddies();
          if (anyBuddyAcceptsNudges(buddies)) {
            await rearmBuddyNudgeBus();
            let blob = (await nudgeBusRef.current?.fetchNudge()) ?? null;
            if (!blob) {
              const relayUrl = getRelayBaseUrl();
              const nativeId = readNativeBuddyEventId();
              if (relayUrl && nativeId) {
                const identity = await loadOrCreateIdentity();
                blob = await new HttpRelayPort(relayUrl).getMailbox(
                  identity.mailboxId,
                  nativeId,
                );
              }
            }
            if (blob) {
              const decoded = decodeNudgeBlob(blob);
              if (decoded) applyDecodedBuddyNudge(decoded);
            }
          }
        } catch {
          /* best-effort */
        }
        applyEffects(effects);
        if (buddyNudgeTextRef.current) {
          // Drop the native "Start challenge" shield — show Buddy nudge only.
          try {
            UnloopUsage.hideInterruptOverlayForInApp();
          } catch {
            /* optional */
          }
          setChallengeOpened(true);
          setChallengeMountKey((k) => k + 1);
        }
      })();
    },
    [applyDecodedBuddyNudge, applyEffects, audit, deviceCaps, engine, rearmBuddyNudgeBus],
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

  const openChallengeFromOverlay = useCallback(() => {
    if (!settingsRef.current) {
      pendingOpenRef.current = true;
      return;
    }
    // Already in CHALLENGE (threshold entered under the overlay): give the user
    // a full timeout window and mount UI — Open is the real start.
    if (engine.state === "CHALLENGE") {
      engine.refreshChallengeDeadline();
      setChallengeOpened(true);
      setChallengeMountKey((k) => k + 1);
      setMessage(t("app.interrupt"));
      return;
    }
    engine.setChallengeOptions(
      settingsRef.current.enabledChallengeIds,
      deviceCaps,
    );
    syncFromNative();
    if (engine.state === "MONITORING") {
      const snap = UnloopUsage.getMonitorSnapshot();
      applyEffects(
        engine.onThresholdReached(
          snap.lastAppId || "unknown",
          snap.lastDeltaU || 0,
        ),
      );
      setChallengeOpened(true);
      setChallengeMountKey((k) => k + 1);
      return;
    }
    // PAUSED / COOLDOWN with outstanding interrupt — hydrate into CHALLENGE.
    applyEffects(
      engine.hydrate({
        monitoring: true,
        challengeOutstanding: true,
        inCooldown: false,
      }),
    );
    setChallengeOpened(true);
    setChallengeMountKey((k) => k + 1);
  }, [applyEffects, deviceCaps, engine, syncFromNative, t]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    const sub = addOpenChallengeListener(() => {
      openChallengeFromOverlay();
    });
    return () => sub.remove();
  }, [openChallengeFromOverlay]);

  // Flush overlay/threshold that arrived before AsyncStorage settings loaded.
  useEffect(() => {
    if (!settings || !pendingOpenRef.current) {
      return;
    }
    pendingOpenRef.current = false;
    openChallengeFromOverlay();
  }, [settings, openChallengeFromOverlay]);

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
            threshold: Math.round(updated.thresholdMs / 60_000),
            cooldown: Math.round(updated.cooldownMs / 60_000),
          }),
        );
      }
    }
  };

  const toggleChallenge = (id: ChallengeId) => {
    if (!settings) {
      return;
    }
    if (HIDDEN_CHALLENGE_IDS.has(id)) {
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
    minutes: number,
  ) => {
    if (!settings) {
      return;
    }
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return;
    }
    persist({ ...settings, [key]: Math.round(minutes * 60_000) });
  };

  const startMonitoring = async () => {
    if (!settings) {
      return;
    }
    if (Platform.OS !== "android") {
      setMessage(t("app.android_only"));
      return;
    }
    // Drop stale AVD harness overrides so normal use honors Settings.
    UnloopUsage.clearHarnessDebugState();
    engine.setChallengeOptions(settings.enabledChallengeIds, deviceCaps);
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
    // Belt-and-suspenders: Settings threshold wins over any stuck harness value.
    UnloopUsage.updateNativeThreshold(settings.thresholdMs);
    await syncBuddyApproachingNative(settings);
    // Progressive Buddy live path (P3-05/07): gated by Settings.
    setBuddyNudgeText(null);
    buddyNudgeTextRef.current = null;
    setBuddyNudgePresetId(null);
    setBuddyNudgeMedia(null);
    setBuddyNudgeDismissed(false);
    await rearmBuddyNudgeBus();
    setMessage(
      t("app.watching", {
        feeds: settings.enabledLabels.join(", "),
        threshold: Math.round(settings.thresholdMs / 60_000),
        cooldown: Math.round(settings.cooldownMs / 60_000),
      }),
    );
  };

  const stopMonitoring = async () => {
    const nb = nudgeBusRef.current;
    const s = settingsRef.current;
    if (nb) {
      const session = nb.active;
      const shouldNotifyLeave = Boolean(
        session && session.approachingSent && !session.cancelled,
      );
      try {
        await nb.cancel();
        if (s?.buddyEnabled && s.buddyNotifyOnLeave && shouldNotifyLeave && session) {
          const relayUrl = getRelayBaseUrl();
          const buddies = await loadBuddies();
          if (relayUrl) {
            await Promise.all(
              buddies.map(async (b) => {
                try {
                  await fetch(
                    `${relayUrl.replace(/\/+$/, "")}/v1/notify/${encodeURIComponent(b.mailboxId)}`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        data: {
                          type: "left_early",
                          eventId: session.eventId,
                          mailboxId: session.mailboxId,
                        },
                      }),
                    },
                  );
                } catch {
                  /* ignore */
                }
              }),
            );
          }
        }
      } catch {
        /* best-effort cancel */
      }
      nudgeBusRef.current = null;
    }
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

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    const sub = addSoftSkipChallengeListener(() => {
      softFailChallenge();
    });
    return () => sub.remove();
  }, [softFailChallenge]);

  const inChallenge = sessionState === "CHALLENGE";
  const hasBuddyNudge = Boolean(buddyNudgeText) && !buddyNudgeDismissed;

  // Buddy nudge: skip the "Start challenge" gate — show the nudge immediately.
  useEffect(() => {
    if (!inChallenge || !hasBuddyNudge || challengeOpened) return;
    try {
      UnloopUsage.hideInterruptOverlayForInApp();
    } catch {
      /* optional */
    }
    setChallengeOpened(true);
    setChallengeMountKey((k) => k + 1);
  }, [inChallenge, hasBuddyNudge, challengeOpened]);
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

  const showLiveCompose =
    Boolean(pendingApproach) &&
    (liveComposeHold || screen === "buddyCompose");

  return (
    <LinearGradient
      colors={
        inChallenge || showLiveCompose
          ? [colors.ink, colors.inkSoft]
          : [colors.mist, colors.mistEnd]
      }
      style={styles.gradient}
    >
      {showLiveCompose && pendingApproach ? (
        <BuddyComposeScreen
          t={t}
          pending={pendingApproach}
          defaultNudge={settings?.buddyDefaultNudge ?? ""}
          onBack={() => {
            setLiveComposeHold(false);
            void setPendingApproach(null);
            setPendingApproachState(null);
            setScreen("home");
          }}
          onDone={() => {
            setLiveComposeHold(false);
            void setPendingApproach(null);
            setPendingApproachState(null);
            setScreen("home");
          }}
        />
      ) : inChallenge && settings && challengeOpened && hasBuddyNudge ? (
        /* Dedicated Buddy nudge surface — no challenge chrome above it. */
        <ScrollView
          contentContainerStyle={styles.challengeContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          <BuddyNudgeView
            t={t}
            body={buddyNudgeText ?? ""}
            presetId={buddyNudgePresetId ?? undefined}
            media={buddyNudgeMedia ?? undefined}
            onContinue={() => setBuddyNudgeDismissed(true)}
            onSkip={softFailChallenge}
          />
        </ScrollView>
      ) : inChallenge && settings && challengeOpened ? (
        <ScrollView
          contentContainerStyle={styles.challengeContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          <Text style={styles.brandOnInk}>Unloop</Text>
          <Text style={styles.taglineOnInk}>{t("app.tagline")}</Text>
          <ChallengeHost
            key={`${activeChallengeId}-${challengeMountKey}`}
            challengeId={activeChallengeId}
            timeoutMs={settings.challengeTimeoutMs}
            t={t}
            onComplete={completeChallenge}
            onSoftFail={softFailChallenge}
            deviceCaps={deviceCaps}
          />
        </ScrollView>
      ) : inChallenge && settings && !challengeOpened ? (
        <ScrollView contentContainerStyle={styles.challengeContainer}>
          <Text style={styles.brandOnInk}>Unloop</Text>
          <Text style={styles.taglineOnInk}>{t("app.tagline")}</Text>
          <Text style={styles.messageOnInk}>
            {hasBuddyNudge
              ? t("buddy.nudge_interrupt")
              : t("app.interrupt")}
          </Text>
          <Pressable
            style={styles.openChallengeBtn}
            onPress={openChallengeFromOverlay}
            accessibilityRole="button"
            accessibilityLabel={
              hasBuddyNudge ? t("buddy.nudge_open") : t("challenge.start")
            }
          >
            <Text style={styles.openChallengeLabel}>
              {hasBuddyNudge ? t("buddy.nudge_open") : t("challenge.start")}
            </Text>
          </Pressable>
          <Pressable
            style={styles.skipChallengeBtn}
            onPress={softFailChallenge}
            accessibilityRole="button"
            accessibilityLabel={t("challenge.skip")}
          >
            <Text style={styles.skipChallengeLabel}>{t("challenge.skip")}</Text>
          </Pressable>
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
          onPatchSettings={(patch) => persist({ ...settings, ...patch })}
          onOpenBuddy={() => {
            setBuddyReturnScreen("settings");
            setScreen("buddy");
          }}
        />
      ) : screen === "buddy" ? (
        <BuddyScreen
          t={t}
          onBack={() => setScreen(buddyReturnScreen)}
          pendingInvite={pendingPairInvite}
          onPendingInviteConsumed={() => setPendingPairInvite(null)}
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
        onOpenBuddy={() => {
          setBuddyReturnScreen("home");
          setScreen("buddy");
        }}
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
  messageOnInk: {
    fontSize: typography.bodySize,
    lineHeight: 24,
    color: colors.textOnInk,
    textAlign: "center",
    marginTop: 12,
    opacity: 0.92,
  },
  openChallengeBtn: {
    marginTop: 20,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.ember,
  },
  openChallengeLabel: {
    fontWeight: "800",
    color: colors.white,
    fontSize: 16,
  },
  skipChallengeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipChallengeLabel: {
    color: colors.textOnInk,
    opacity: 0.75,
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
