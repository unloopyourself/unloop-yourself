import type { LocaleCode } from "../i18n";

/**
 * Unlock phrases to type — short, phone-friendly, exit-the-loop tone.
 * No guilt or judgment: invitation to pause and leave the scroll.
 */
export const UNLOCK_PHRASES: Record<LocaleCode, readonly string[]> = {
  en: [
    "I asked for this",
    "Look up for a moment",
    "Step out of the scroll",
    "One breath at a time",
    "I choose to pause",
    "Back to the room",
    "Hands off the feed",
    "I can put it down",
    "This can wait",
    "Outside the tunnel",
    "Leave the loop",
    "The feed can wait",
    "Come back to now",
    "I set the pace",
    "Eyes on the world",
    "Break the autopilot",
    "Body before the feed",
    "Come up for air",
    "I leave the tunnel",
    "Feel your feet again",
    "Soft stop then go",
    "Away from the glow",
    "Done for now",
    "Back to living",
    "I am still here",
    "Open space around me",
    "Stay with the pause",
    "Breathe then decide",
  ],
  it: [
    "L'ho chiesto io",
    "Alza lo sguardo un attimo",
    "Esci dallo scroll",
    "Un respiro alla volta",
    "Scelgo di fermarmi",
    "Di nuovo nella stanza",
    "Via le mani dal feed",
    "Posso metterlo giù",
    "Questo può aspettare",
    "Fuori dal tunnel",
    "Lascia il loop",
    "Il feed può aspettare",
    "Torna al presente",
    "Imposto io il ritmo",
    "Occhi sul mondo",
    "Rompi l'autopilota",
    "Prima il corpo poi il feed",
    "Vieni a prendere aria",
    "Lascio il tunnel",
    "Senti di nuovo i piedi",
    "Stop dolce poi via",
    "Lontano dal bagliore",
    "Basta per ora",
    "Di nuovo a vivere",
    "Sono ancora qui",
    "Apri spazio intorno",
    "Resta nella pausa",
    "Respira poi decidi",
  ],
};

let lastPhrase: string | null = null;

/**
 * Pick a random phrase for the current locale.
 * Avoids repeating the previous pick when the pack has ≥2 options.
 */
export function pickUnlockPhrase(
  locale: LocaleCode,
  random: () => number = Math.random,
): string {
  const pack = UNLOCK_PHRASES[locale] ?? UNLOCK_PHRASES.en;
  let pool: readonly string[] = pack;
  if (lastPhrase != null && pack.length >= 2) {
    const without = pack.filter((p) => p !== lastPhrase);
    if (without.length > 0) {
      pool = without;
    }
  }
  const idx = Math.floor(random() * pool.length);
  const picked = pool[idx] ?? pack[0]!;
  lastPhrase = picked;
  return picked;
}

/** Test helper — reset consecutive-pick memory. */
export function resetUnlockPhraseMemory(): void {
  lastPhrase = null;
}
