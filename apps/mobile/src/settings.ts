import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_ENABLED_LABELS } from "./targets";

const KEY = "unloop.settings.v1";

export type UnloopSettings = {
  enabledLabels: string[];
};

export async function loadSettings(): Promise<UnloopSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return { enabledLabels: [...DEFAULT_ENABLED_LABELS] };
    }
    const parsed = JSON.parse(raw) as UnloopSettings;
    if (!Array.isArray(parsed.enabledLabels) || parsed.enabledLabels.length === 0) {
      return { enabledLabels: [...DEFAULT_ENABLED_LABELS] };
    }
    return parsed;
  } catch {
    return { enabledLabels: [...DEFAULT_ENABLED_LABELS] };
  }
}

export async function saveSettings(settings: UnloopSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}
