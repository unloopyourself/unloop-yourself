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
  | "face_down_flip"
  | "coin_spin"
  | "air_write"
  | "hold_still"
  | "countdown_type"
  | "long_press"
  | "intention_type"
  | "look_away"
  | "rotate_phone"
  | "stand_up"
  | "sip_water"
  | "feeling_check"
  | "audio_silence_tap";

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
  coin_spin: "challenge.coin.title",
  air_write: "challenge.air.title",
  hold_still: "challenge.hold_still.title",
  countdown_type: "challenge.countdown.title",
  long_press: "challenge.long_press.title",
  intention_type: "challenge.intention.title",
  look_away: "challenge.look_away.title",
  rotate_phone: "challenge.rotate.title",
  stand_up: "challenge.stand_up.title",
  sip_water: "challenge.sip_water.title",
  feeling_check: "challenge.feeling.title",
  audio_silence_tap: "challenge.silence_tap.title",
};

/**
 * Challenges that may play a short device tone (Android ToneGenerator adapter).
 */
export const AUDIO_CHALLENGE_IDS: ReadonlySet<ChallengeId> = new Set([
  "audio_silence_tap",
]);

/** UI catalog: Core requires + local title keys (single source for requires). */
export const CHALLENGE_CATALOG: ChallengeMeta[] = MVP_CHALLENGES.map((c) => ({
  ...c,
  id: c.id as ChallengeId,
  titleKey: TITLE_KEYS[c.id as ChallengeId],
}));

/**
 * Challenges kept in code but hidden from Settings / not selectable in this release.
 * (Air write needs more sensor UX work before shipping.)
 */
export const HIDDEN_CHALLENGE_IDS: ReadonlySet<ChallengeId> = new Set([
  "air_write",
]);

/** Catalog shown in Settings — excludes {@link HIDDEN_CHALLENGE_IDS}. */
export const SETTINGS_CHALLENGE_CATALOG: ChallengeMeta[] =
  CHALLENGE_CATALOG.filter((c) => !HIDDEN_CHALLENGE_IDS.has(c.id));

export const DEFAULT_ENABLED_CHALLENGE_IDS: ChallengeId[] = [
  ...MVP_DEFAULT_ENABLED_IDS,
] as ChallengeId[];

/** Drop hidden ids so a prior opt-in cannot keep selecting them. */
export function sanitizeEnabledChallengeIds(
  ids: readonly string[],
): ChallengeId[] {
  const kept = ids.filter(
    (id): id is ChallengeId =>
      CHALLENGE_CATALOG.some((c) => c.id === id) &&
      !HIDDEN_CHALLENGE_IDS.has(id as ChallengeId),
  );
  return kept.length > 0
    ? kept
    : [...DEFAULT_ENABLED_CHALLENGE_IDS];
}
export function pickChallengeId(
  enabledIds: readonly string[],
  available: ReadonlySet<Capability>,
  excludeId?: string | null,
): ChallengeId {
  const id = pickEligibleChallengeId(MVP_CHALLENGES, enabledIds, available, {
    excludeId,
  });
  return (id ?? "breath_tap") as ChallengeId;
}

export function isAudioChallenge(id: ChallengeId): boolean {
  return AUDIO_CHALLENGE_IDS.has(id);
}
