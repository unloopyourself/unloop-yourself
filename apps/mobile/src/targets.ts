export type ShortVideoApp = {
  /** Display name */
  label: string;
  /** One or more Android package ids (regional variants). */
  packages: string[];
};

/**
 * Feeds / doomscroll surfaces Unloop can watch.
 * “Browsers” is one chip covering common Chromium/Gecko browsers — Android has
 * no generic “any browser” API, so we list packages explicitly.
 */
export const SHORT_VIDEO_APPS: ShortVideoApp[] = [
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

export const DEFAULT_ENABLED_LABELS = ["YouTube", "TikTok", "Instagram"] as const;

/** Time in a target feed before interrupt. */
export const THRESHOLD_MS = 60_000;

/** Grace after a completed challenge before interrupting again. */
export const COOLDOWN_MS = 120_000;

export function packagesForLabels(labels: string[]): string[] {
  const set = new Set(labels);
  return SHORT_VIDEO_APPS.filter((a) => set.has(a.label)).flatMap((a) => a.packages);
}
