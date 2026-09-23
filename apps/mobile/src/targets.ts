export type ShortVideoApp = {
  /** Display name */
  label: string;
  /** One or more Android package ids (regional variants). */
  packages: string[];
};

/** Short-video / infinite-feed apps Unloop can watch for autopilot. */
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
