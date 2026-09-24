export type WatchTarget = {
  /** Display name (catalog key may differ; label used in chips). */
  label: string;
  /** One or more Android package ids (regional variants). */
  packages: string[];
};

/**
 * Surfaces Unloop can watch for autopilot.
 * “Browsers” / “AI chats” group several packages under one chip.
 */
export const WATCH_TARGETS: WatchTarget[] = [
  {
    label: "YouTube",
    packages: ["com.google.android.youtube"],
  },
  {
    label: "TikTok",
    packages: ["com.zhiliaoapp.musically", "com.ss.android.ugc.trill"],
  },
  {
    label: "Instagram",
    packages: ["com.instagram.android"],
  },
  {
    label: "Snapchat",
    packages: ["com.snapchat.android"],
  },
  {
    label: "Facebook",
    packages: ["com.facebook.katana", "com.facebook.lite"],
  },
  {
    label: "X",
    packages: ["com.twitter.android"],
  },
  {
    label: "Reddit",
    packages: ["com.reddit.frontpage"],
  },
  {
    label: "AI chats",
    packages: [
      "com.openai.chatgpt",
      "com.google.android.apps.bard",
      "com.google.android.apps.gemini",
      "com.anthropic.claude",
      "ai.character.app",
      "ai.perplexity.app.android",
      "com.microsoft.copilot",
      "com.microsoft.bing",
    ],
  },
  {
    label: "Dummy feed",
    packages: ["dev.unloopyourself.dummytarget"],
  },
  {
    label: "Browsers",
    packages: [
      "com.android.chrome",
      "com.chrome.beta",
      "com.chrome.dev",
      "org.mozilla.firefox",
      "org.mozilla.firefox_beta",
      "org.mozilla.focus",
      "com.opera.browser",
      "com.opera.mini.native",
      "com.brave.browser",
      "com.microsoft.emmx",
      "com.sec.android.app.sbrowser",
      "com.duckduckgo.mobile.android",
      "com.vivaldi.browser",
      "com.kiwibrowser.browser",
      "org.torproject.torbrowser",
    ],
  },
];

/** @deprecated Use WATCH_TARGETS */
export const SHORT_VIDEO_APPS = WATCH_TARGETS;

export const DEFAULT_ENABLED_LABELS = ["YouTube", "TikTok", "Instagram"] as const;

/** Time in a target feed before interrupt. */
export const THRESHOLD_MS = 60_000;

/** Grace after a completed challenge before interrupting again. */
export const COOLDOWN_MS = 120_000;

/** Soft unlock: release the feed without success (not a ban). */
export const CHALLENGE_TIMEOUT_MS = 45_000;

export function packagesForLabels(labels: string[]): string[] {
  const set = new Set(labels);
  return WATCH_TARGETS.filter((a) => set.has(a.label)).flatMap((a) => a.packages);
}
