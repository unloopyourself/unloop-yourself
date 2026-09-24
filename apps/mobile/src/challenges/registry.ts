import type { Capability, Challenge } from "@unloop/core";

export type ChallengeId =
  | "shake"
  | "breath_tap"
  | "unlock_phrase"
  | "nearest_multiple"
  | "face_down_flip";

export type ChallengeMeta = Challenge & {
  id: ChallengeId;
  /** i18n title key */
  titleKey: string;
};

export const CHALLENGE_CATALOG: ChallengeMeta[] = [
  {
    id: "shake",
    titleKey: "challenge.shake.title",
    requires: new Set<Capability>(["accelerometer"]),
  },
  {
    id: "breath_tap",
    titleKey: "challenge.breath.title",
    requires: new Set<Capability>(),
  },
  {
    id: "unlock_phrase",
    titleKey: "challenge.phrase.title",
    requires: new Set<Capability>(),
  },
  {
    id: "nearest_multiple",
    titleKey: "challenge.math.title",
    requires: new Set<Capability>(),
  },
  {
    id: "face_down_flip",
    titleKey: "challenge.face.title",
    requires: new Set<Capability>(["accelerometer"]),
  },
];

export const DEFAULT_ENABLED_CHALLENGE_IDS: ChallengeId[] = [
  "shake",
  "breath_tap",
  "unlock_phrase",
  "nearest_multiple",
];

export function pickChallengeId(
  enabledIds: readonly string[],
  available: ReadonlySet<Capability>,
): ChallengeId {
  const enabled = new Set(enabledIds);
  const compatible = CHALLENGE_CATALOG.filter(
    (c) =>
      enabled.has(c.id) &&
      [...c.requires].every((cap) => available.has(cap)),
  );
  const softOnly = CHALLENGE_CATALOG.filter(
    (c) => c.requires.size === 0 && enabled.has(c.id),
  );
  const pool =
    compatible.length > 0
      ? compatible
      : softOnly.length > 0
        ? softOnly
        : CHALLENGE_CATALOG.filter((c) => c.requires.size === 0);
  const fallback = pool.length > 0 ? pool : CHALLENGE_CATALOG;
  const idx = Math.floor(Math.random() * fallback.length);
  return fallback[idx]!.id;
}
