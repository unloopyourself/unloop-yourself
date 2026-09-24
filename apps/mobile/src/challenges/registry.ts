import {
  MVP_CHALLENGES,
  MVP_DEFAULT_ENABLED_IDS,
  pickEligibleChallengeId,
  type Capability,
  type Challenge,
} from "@unloop/core";

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

const TITLE_KEYS: Record<ChallengeId, string> = {
  shake: "challenge.shake.title",
  breath_tap: "challenge.breath.title",
  unlock_phrase: "challenge.phrase.title",
  nearest_multiple: "challenge.math.title",
  face_down_flip: "challenge.face.title",
};

/** UI catalog: Core requires + local title keys (single source for requires). */
export const CHALLENGE_CATALOG: ChallengeMeta[] = MVP_CHALLENGES.map((c) => ({
  ...c,
  id: c.id as ChallengeId,
  titleKey: TITLE_KEYS[c.id as ChallengeId],
}));

export const DEFAULT_ENABLED_CHALLENGE_IDS: ChallengeId[] = [
  ...MVP_DEFAULT_ENABLED_IDS,
] as ChallengeId[];

export function pickChallengeId(
  enabledIds: readonly string[],
  available: ReadonlySet<Capability>,
): ChallengeId {
  const id = pickEligibleChallengeId(MVP_CHALLENGES, enabledIds, available);
  return (id ?? "breath_tap") as ChallengeId;
}
