export type LocaleCode = "en" | "it";

type Dict = Record<string, string>;

const en: Dict = {
  "app.tagline": "Exit the tunnel. You’re the one who asked.",
  "app.intro": "I’m here because you asked me to interrupt autopilot.",
  "app.watching": "Watching {feeds}. After ~{threshold}s in a feed I’ll interrupt — then {cooldown}s of grace.",
  "app.watching_short": "Watching — after ~{threshold}s in a feed I’ll interrupt.",
  "app.back_on_watch": "Back on watch. You’ve got this.",
  "app.stopped": "Monitoring stopped. The feeds are yours again.",
  "app.interrupt": "Pause. A short challenge — you asked for this.",
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
  "nav.menu": "Menu",
  "nav.settings": "Settings",
  "nav.about": "About",
  "nav.back": "Back",
  "nav.close": "Close",
  "home.status_paused": "Ready when you are",
  "home.status_monitoring": "Watching",
  "home.status_cooldown": "Grace period",
  "home.open_settings_hint": "Feeds, challenges, and timings live in Settings.",
  "about.title": "About Unloop",
  "about.lead": "A short interrupt when scrolling takes over — not a punisher, paywall, or tracker.",
  "about.privacy": "Usage data and audit logs stay on this device. No analytics SDKs. No behavioral telemetry backends.",
  "about.contact": "Contact",
  "about.source": "Source & issues",
  "about.repo": "github.com/unloopyourself/unloop-yourself",
  "about.issues": "Open an issue",
  "about.version": "Version {version}",
  "about.email": "unloopyourself.dev@gmail.com",
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
  "challenge.coin.title": "Coin spin",
  "challenge.coin.body": "Rest the phone on a coin (or similar pivot). Spin it about five full turns with two fingers near the center.",
  "challenge.air.title": "Air write",
  "challenge.air.body": "Write this short word in the air with the phone — big strokes, not thumb-scroll.",
  "challenge.air.hint": "Start drawing… pause briefly between strokes.",
  "challenge.air.drawing": "Keep going — pause between letters if you like.",
  "challenge.air.done": "Got it!",
  "challenge.air.strokes": "Strokes: {n}",
};

const it: Dict = {
  "app.tagline": "Esci dal tunnel. Sei tu che l’hai chiesto.",
  "app.intro": "Sono qui perché mi hai chiesto di interrompere l’autopilota.",
  "app.watching": "Monitoro {feeds}. Dopo ~{threshold}s in un feed ti interrompo — poi {cooldown}s di tregua.",
  "app.watching_short": "In ascolto — dopo ~{threshold}s in un feed ti interrompo.",
  "app.back_on_watch": "Di nuovo in ascolto. Ce la fai.",
  "app.stopped": "Monitoraggio fermato. I feed sono di nuovo tuoi.",
  "app.interrupt": "Pausa. Una breve challenge — me l’hai chiesto tu.",
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
  "nav.menu": "Menu",
  "nav.settings": "Impostazioni",
  "nav.about": "Informazioni",
  "nav.back": "Indietro",
  "nav.close": "Chiudi",
  "home.status_paused": "Pronto quando lo sei tu",
  "home.status_monitoring": "In ascolto",
  "home.status_cooldown": "Tregua",
  "home.open_settings_hint": "Feed, challenge e tempi sono in Impostazioni.",
  "about.title": "Informazioni su Unloop",
  "about.lead": "Una breve interruzione quando lo scroll prende il sopravvento — non un castigo, un paywall o un tracker.",
  "about.privacy": "Dati di utilizzo e log restano su questo dispositivo. Niente SDK di analytics. Niente telemetria comportamentale.",
  "about.contact": "Contatti",
  "about.source": "Codice e segnalazioni",
  "about.repo": "github.com/unloopyourself/unloop-yourself",
  "about.issues": "Apri una issue",
  "about.version": "Versione {version}",
  "about.email": "unloopyourself.dev@gmail.com",
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
  "challenge.coin.title": "Giro sulla moneta",
  "challenge.coin.body": "Appoggia il telefono su una moneta (o un perno simile). Falle fare circa cinque giri completi con due dita vicino al centro.",
  "challenge.air.title": "Scrivi in aria",
  "challenge.air.body": "Scrivi questa parola corta in aria col telefono — tratti ampi, non lo scroll.",
  "challenge.air.hint": "Inizia a disegnare… pausa breve tra un tratto e l’altro.",
  "challenge.air.drawing": "Continua — puoi fare una pausa tra le lettere.",
  "challenge.air.done": "Preso!",
  "challenge.air.strokes": "Tratti: {n}",
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
