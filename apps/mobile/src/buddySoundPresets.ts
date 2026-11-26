import type { SoundPresetId } from "@unloop/core";
import { SOUND_PRESET_IDS } from "@unloop/core";

/** Bundled original SFX (generated; replaceable with CC0 later). */
export const SOUND_PRESET_ASSETS: Record<SoundPresetId, number> = {
  ship_horn: require("../assets/buddy-presets/ship_horn.wav"),
  truck_horn: require("../assets/buddy-presets/truck_horn.wav"),
  hell_yeah: require("../assets/buddy-presets/hell_yeah.wav"),
};

export const SOUND_PRESET_I18N_KEYS: Record<
  SoundPresetId,
  "buddy.preset_ship_horn" | "buddy.preset_truck_horn" | "buddy.preset_hell_yeah"
> = {
  ship_horn: "buddy.preset_ship_horn",
  truck_horn: "buddy.preset_truck_horn",
  hell_yeah: "buddy.preset_hell_yeah",
};

export function isSoundPresetId(id: string): id is SoundPresetId {
  return (SOUND_PRESET_IDS as readonly string[]).includes(id);
}
