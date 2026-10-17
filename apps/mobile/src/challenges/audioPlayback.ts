import { Audio } from "expo-av";

let audioModeReady = false;

async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) {
    return;
  }
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
    staysActiveInBackground: false,
  });
  audioModeReady = true;
}

export async function playSound(
  module: number,
  options?: { volume?: number },
): Promise<void> {
  await ensureAudioMode();
  const { sound } = await Audio.Sound.createAsync(module, {
    shouldPlay: true,
    volume: options?.volume ?? 1,
  });
  await new Promise<void>((resolve) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) {
        return;
      }
      if (status.didJustFinish) {
        void sound.unloadAsync();
        resolve();
      }
    });
  });
}

export const SOUND_BEEP = require("../../assets/sounds/beep.wav");
export const SOUND_BEEP_LOW = require("../../assets/sounds/beep_low.wav");
export const SOUND_TONE_HOLD = require("../../assets/sounds/tone_hold.wav");
