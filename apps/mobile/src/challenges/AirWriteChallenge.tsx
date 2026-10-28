import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  AIR_SETTLE_MS,
  advanceAirWriteTracker,
  circleProgress,
  createAirWriteTracker,
  currentCorridor,
  normalizePath,
  pickAirWriteWord,
  pointInCorridor,
  type AirCorridor,
  type AirPoint,
  type AirWriteLocale,
  type AirWriteTrackerState,
} from "@unloop/core";
import type { Translate } from "../i18n";
import { detectLocale } from "../i18n";
import { subscribeAccelerometerRaw } from "../expoSensorPort";
import { colors, typography } from "../theme";

type Props = {
  t: Translate;
  onComplete: () => void;
};

const GRID = 28;
const PREVIEW = 168;

function displayWord(target: string, recognized: string): string {
  const chars = target.split("").map((ch, i) => {
    if (i < recognized.length) {
      return ch;
    }
    if (i === recognized.length) {
      return "_";
    }
    return "·";
  });
  return chars.join(" ");
}

function stepLabel(state: AirWriteTrackerState, t: Translate): string {
  if (state.phase === "complete") {
    return t("challenge.air.done");
  }
  if (state.phase === "drawing") {
    return t("challenge.air.step_draw");
  }
  return t("challenge.air.step_circle");
}

function hintFor(state: AirWriteTrackerState, t: Translate): string {
  if (state.phase === "complete") {
    return t("challenge.air.done");
  }
  if (state.needsRetry) {
    const pct = Math.round(state.lastCoverage * 100);
    return t("challenge.air.retry", { pct });
  }
  const letter = state.targetWord[state.letterIndex] ?? "";
  if (state.phase === "drawing") {
    return t("challenge.air.drawing", { letter });
  }
  if (state.settleMs < AIR_SETTLE_MS) {
    return t("challenge.air.settle");
  }
  const stroke = state.strokeIndex + 1;
  const total = state.strokeCountInLetter;
  if (total > 1 && state.strokeIndex > 0) {
    return t("challenge.air.await_stroke", {
      letter,
      stroke,
      total,
    });
  }
  return t("challenge.air.await_start");
}

function AirWritePreview({
  corridor,
  path,
  cursor,
  showCircleGuide,
}: {
  corridor: AirCorridor | null;
  path: readonly AirPoint[];
  cursor: AirPoint | null;
  showCircleGuide: boolean;
}) {
  const cells = useMemo(() => {
    const road: boolean[] = new Array(GRID * GRID).fill(false);
    const ink: boolean[] = new Array(GRID * GRID).fill(false);
    if (corridor) {
      for (let j = 0; j < GRID; j++) {
        for (let i = 0; i < GRID; i++) {
          const p = {
            x: (i + 0.5) / GRID,
            y: 1 - (j + 0.5) / GRID,
          };
          if (pointInCorridor(p, corridor)) {
            road[j * GRID + i] = true;
          }
        }
      }
    }
    const norm = normalizePath(path);
    for (const p of norm) {
      const i = Math.min(GRID - 1, Math.max(0, Math.floor(p.x * GRID)));
      const j = Math.min(GRID - 1, Math.max(0, Math.floor((1 - p.y) * GRID)));
      ink[j * GRID + i] = true;
    }
    return { road, ink };
  }, [corridor, path]);

  const cell = PREVIEW / GRID;
  const cursorNorm =
    cursor && path.length >= 2
      ? (normalizePath([...path, cursor]).at(-1) ?? null)
      : cursor && path.length === 1
        ? (normalizePath([path[0]!, cursor]).at(-1) ?? null)
        : cursor
          ? {
              x: 0.5 + cursor.x * 0.45,
              y: 0.5 + cursor.y * 0.45,
            }
          : null;

  return (
    <View
      style={[styles.preview, { width: PREVIEW, height: PREVIEW }]}
      accessibilityLabel="Air write preview"
    >
      {showCircleGuide ? (
        <View style={styles.circleGuide} pointerEvents="none">
          <View style={styles.circleGuideRing} />
        </View>
      ) : null}
      {cells.road.map((on, idx) => {
        if (!on) {
          return null;
        }
        const i = idx % GRID;
        const j = Math.floor(idx / GRID);
        return (
          <View
            key={`r${idx}`}
            style={[
              styles.roadCell,
              {
                width: cell,
                height: cell,
                left: i * cell,
                top: j * cell,
              },
            ]}
          />
        );
      })}
      {cells.ink.map((on, idx) => {
        if (!on) {
          return null;
        }
        const i = idx % GRID;
        const j = Math.floor(idx / GRID);
        return (
          <View
            key={`i${idx}`}
            style={[
              styles.inkCell,
              {
                width: cell,
                height: cell,
                left: i * cell,
                top: j * cell,
              },
            ]}
          />
        );
      })}
      {cursorNorm ? (
        <View
          style={[
            styles.cursor,
            {
              left: Math.min(
                PREVIEW - 10,
                Math.max(0, cursorNorm.x * PREVIEW - 5),
              ),
              top: Math.min(
                PREVIEW - 10,
                Math.max(0, (1 - cursorNorm.y) * PREVIEW - 5),
              ),
            },
          ]}
        />
      ) : null}
    </View>
  );
}

export function AirWriteChallenge({ t, onComplete }: Props) {
  const locale = useMemo((): AirWriteLocale => {
    return detectLocale() === "it" ? "it" : "en";
  }, []);
  const targetWord = useMemo(() => pickAirWriteWord(locale), [locale]);
  const [ui, setUi] = useState(() => createAirWriteTracker(targetWord));
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let state = createAirWriteTracker(targetWord);
    setUi(state);
    let finished = false;
    const { stop } = subscribeAccelerometerRaw((ax, ay, az, deltaMs) => {
      if (finished) {
        return;
      }
      state = advanceAirWriteTracker(state, { ax, ay, az, deltaMs });
      setUi(state);
      if (state.phase === "complete") {
        finished = true;
        stop();
        queueMicrotask(() => onCompleteRef.current());
      }
    }, 40);
    return () => stop();
  }, [targetWord]);

  const letter = ui.targetWord[ui.letterIndex] ?? "";
  const awaitingStart = ui.phase === "await_start";
  const settling = awaitingStart && ui.settleMs < AIR_SETTLE_MS;
  const corridor = awaitingStart ? null : currentCorridor(ui);
  const previewPath = awaitingStart
    ? ui.delimPath
    : ui.phase === "drawing"
      ? ui.path
      : [];
  const cursor =
    ui.phase === "drawing"
      ? { x: ui.posX, y: ui.posY }
      : awaitingStart && ui.delimArmed && !settling
        ? { x: ui.delimPosX, y: ui.delimPosY }
        : null;
  const progressPct = awaitingStart
    ? Math.round(circleProgress(ui.delimPath) * 100)
    : 0;

  return (
    <View style={styles.wrap} accessibilityLabel="Air write challenge">
      <Text style={styles.title}>{t("challenge.air.title")}</Text>
      <Text style={styles.subtitle}>{t("challenge.air.body")}</Text>
      <Text style={styles.step}>{stepLabel(ui, t)}</Text>
      {awaitingStart ? (
        <Text style={styles.nextWord}>
          {t("challenge.air.next_word", {
            word: displayWord(ui.targetWord, ui.recognized),
          })}
        </Text>
      ) : (
        <Text style={styles.word}>
          {displayWord(ui.targetWord, ui.recognized)}
        </Text>
      )}
      {!awaitingStart && ui.phase !== "complete" && letter ? (
        <Text style={styles.letter}>{letter}</Text>
      ) : null}
      <AirWritePreview
        corridor={corridor}
        path={previewPath}
        cursor={cursor}
        showCircleGuide={awaitingStart}
      />
      {awaitingStart && !settling ? (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, progressPct)}%` },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {t("challenge.air.circle_progress", { pct: progressPct })}
          </Text>
        </View>
      ) : null}
      <Text style={styles.meta}>{hintFor(ui, t)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  title: {
    fontSize: typography.titleSize,
    fontWeight: "800",
    color: colors.white,
  },
  subtitle: {
    fontSize: typography.bodySize,
    lineHeight: 22,
    textAlign: "center",
    color: colors.textOnInk,
    opacity: 0.9,
  },
  step: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: colors.ember,
    textAlign: "center",
  },
  nextWord: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textOnInk,
    opacity: 0.85,
    textAlign: "center",
  },
  word: {
    marginTop: 2,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 4,
    color: colors.emberSoft,
  },
  letter: {
    fontSize: 48,
    fontWeight: "800",
    color: colors.white,
  },
  preview: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    position: "relative",
  },
  circleGuide: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  circleGuideRing: {
    width: PREVIEW * 0.48,
    height: PREVIEW * 0.48,
    borderRadius: PREVIEW * 0.24,
    borderWidth: 3,
    borderColor: "rgba(232, 168, 124, 0.65)",
    borderStyle: "dashed",
  },
  roadCell: {
    position: "absolute",
    backgroundColor: "rgba(232, 168, 124, 0.35)",
  },
  inkCell: {
    position: "absolute",
    backgroundColor: colors.white,
    opacity: 0.92,
  },
  cursor: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.ember,
    borderWidth: 1,
    borderColor: colors.white,
  },
  progressWrap: {
    width: "100%",
    gap: 6,
    alignItems: "center",
  },
  progressTrack: {
    width: "100%",
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.inkSoft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.ember,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.emberSoft,
    textAlign: "center",
  },
  meta: {
    fontSize: typography.metaSize,
    fontWeight: "600",
    color: colors.emberSoft,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 4,
  },
});
