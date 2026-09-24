export type LocaleCode = "en" | "it";

type Dict = Record<string, string>;

const en: Dict = {
  "app.tagline": "Exit the tunnel. You’re the one who asked.",
  "app.intro": "I’m here because you asked me to interrupt autopilot.",
  "app.watching": "Watching {feeds}. After ~{threshold}s in a feed I’ll interrupt — then {cooldown}s of grace.",
  "app.watching_short": "Watching — after ~{threshold}s in a feed I’ll interrupt.",
  "app.back_on_watch": "Back on watch. You’ve got this.",
  "app.stopped": "Monitoring stopped. The feeds are yours again.",
  "app.interrupt": "Pause. Shake to continue — you asked for this.",
  "app.challenge_ok": "Nice. {cooldown}s grace — then I’ll watch again if you ask me to.",
  "app.soft_fail": "No worries — that one slipped by. Glad you looked up for a moment. The world outside the feed is still there.",
  "app.feeds_section": "Feeds to interrupt",
  "app.challenges_section": "Challenges",
  "app.timings_section": "Timings",
  "app.threshold": "Interrupt after (seconds)",
  "app.cooldown": "Grace after challenge (seconds)",
  "app.soft_timeout": "Soft unlock after (seconds)",
  "app.start": "Start watching",
  "app.stop": "Stop watching",
  "app.usage": "Usage Access",
  "app.overlay": "Overlay",
  "app.ok": "ok",
  "app.needed": "needed",
  "app.pick_feed": "Pick at least one feed to watch.",
  "app.android_only": "Usage detection is Android-first (Phase 2 for iOS).",
  "app.grant_usage": "Grant Usage Access, then tap Start again.",
  "app.grant_overlay": "Allow “Display over other apps” so I can cover the feed when the threshold hits, then Start again.",
  "challenge.skip": "Skip for now",
  "challenge.shake.title": "Shake to come back",
  "challenge.shake.body": "You asked me to interrupt. Move your body for a few seconds — scrolling can’t do that for you.",
  "challenge.breath.title": "Breathe with me",
  "challenge.breath.body": "Three calm breaths. Tap on each exhale.",
  "challenge.breath.tap": "Tap on exhale",
  "challenge.phrase.title": "Type to unlock",
  "challenge.phrase.body": "Type the phrase below — thumbs, not scroll.",
  "challenge.phrase.prompt": "I asked for this",
  "challenge.math.title": "Quick mind check",
  "challenge.math.body": "One small question — then you’re free.",
  "challenge.math.submit": "Unlock",
  "challenge.face.title": "Face-down flip",
  "challenge.face.body": "Phone face down… hold… then flip face-up when I say now.",
  "challenge.face.down": "Face down — hold steady…",
  "challenge.face.flip": "Flip now!",
  "challenge.face.wait": "Waiting for face-down…",
};

const it: Dict = {
  "app.tagline": "Esci dal tunnel. Sei tu che l’hai chiesto.",
  "app.intro": "Sono qui perché mi hai chiesto di interrompere l’autopilota.",
  "app.watching": "Monitoro {feeds}. Dopo ~{threshold}s in un feed ti interrompo — poi {cooldown}s di tregua.",
  "app.watching_short": "In ascolto — dopo ~{threshold}s in un feed ti interrompo.",
  "app.back_on_watch": "Di nuovo in ascolto. Ce la fai.",
  "app.stopped": "Monitoraggio fermato. I feed sono di nuovo tuoi.",
  "app.interrupt": "Pausa. Continua con la challenge — me l’hai chiesto tu.",
  "app.challenge_ok": "Bene. {cooldown}s di tregua — poi riprendo se me lo chiedi.",
  "app.soft_fail": "Nessun problema — questa è sfuggita. Mi fa piacere che tu abbia alzato lo sguardo un attimo. Fuori dal feed c’è ancora un mondo.",
  "app.feeds_section": "Feed da interrompere",
  "app.challenges_section": "Challenge",
  "app.timings_section": "Tempi",
  "app.threshold": "Interrompi dopo (secondi)",
  "app.cooldown": "Tregua dopo la challenge (secondi)",
  "app.soft_timeout": "Sblocco soft dopo (secondi)",
  "app.start": "Inizia a monitorare",
  "app.stop": "Smetti di monitorare",
  "app.usage": "Accesso utilizzo",
  "app.overlay": "Overlay",
  "app.ok": "ok",
  "app.needed": "serve",
  "app.pick_feed": "Scegli almeno un feed.",
  "app.android_only": "Il rilevamento uso è Android-first (Phase 2 per iOS).",
  "app.grant_usage": "Concedi Accesso utilizzo, poi di nuovo Start.",
  "app.grant_overlay": "Consenti “Mostra sopra altre app”, poi di nuovo Start.",
  "challenge.skip": "Salta per ora",
  "challenge.shake.title": "Scuoti per tornare",
  "challenge.shake.body": "Mi hai chiesto di interromperti. Muovi il corpo qualche secondo — lo scroll non può farlo al posto tuo.",
  "challenge.breath.title": "Respira con me",
  "challenge.breath.body": "Tre respiri calmi. Tocca a ogni espirazione.",
  "challenge.breath.tap": "Tocca all’espirazione",
  "challenge.phrase.title": "Scrivi per sbloccare",
  "challenge.phrase.body": "Digita la frase qui sotto — non è uno scroll.",
  "challenge.phrase.prompt": "Me l’ho chiesto io",
  "challenge.math.title": "Piccolo check mentale",
  "challenge.math.body": "Una domanda breve — poi sei libero.",
  "challenge.math.submit": "Sblocca",
  "challenge.face.title": "Faccia in giù e flip",
  "challenge.face.body": "Telefono a faccia in giù… tieni… poi giralo quando dico ora.",
  "challenge.face.down": "Faccia in giù — resta fermo…",
  "challenge.face.flip": "Gira ora!",
  "challenge.face.wait": "In attesa della faccia in giù…",
};

const catalogs: Record<LocaleCode, Dict> = { en, it };

export function detectLocale(): LocaleCode {
  try {
    const loc =
      Intl.DateTimeFormat().resolvedOptions().locale?.toLowerCase() ?? "en";
    if (loc.startsWith("it")) {
      return "it";
    }
  } catch {
    /* fall through */
  }
  return "en";
}

export function createTranslator(locale: LocaleCode) {
  const dict = catalogs[locale] ?? catalogs.en;
  const fallback = catalogs.en;
  return function t(key: string, vars?: Record<string, string | number>): string {
    let out = dict[key] ?? fallback[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        out = out.split(`{${k}}`).join(String(v));
      }
    }
    return out;
  };
}

export type Translate = ReturnType<typeof createTranslator>;
