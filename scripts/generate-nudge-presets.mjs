/**
 * Generate original short WAV SFX for Buddy sound presets (no third-party samples).
 * Output: apps/mobile/assets/buddy-presets/*.wav
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(
  __dirname,
  "..",
  "apps",
  "mobile",
  "assets",
  "buddy-presets",
);

function writeWav(filePath, samples, sampleRate = 22050) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

function toneBurst({
  durationSec,
  freqs,
  sampleRate = 22050,
  attack = 0.02,
  release = 0.08,
  gain = 0.45,
}) {
  const n = Math.floor(durationSec * sampleRate);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let env = 1;
    if (t < attack) env = t / attack;
    else if (t > durationSec - release) {
      env = Math.max(0, (durationSec - t) / release);
    }
    let s = 0;
    for (const f of freqs) {
      s += Math.sin(2 * Math.PI * f * t);
    }
    samples[i] = (s / freqs.length) * env * gain;
  }
  return samples;
}

fs.mkdirSync(outDir, { recursive: true });

// Low dual-tone “horn”
writeWav(
  path.join(outDir, "ship_horn.wav"),
  toneBurst({ durationSec: 1.2, freqs: [110, 165], gain: 0.5 }),
);

// Mid brassy blare
writeWav(
  path.join(outDir, "truck_horn.wav"),
  toneBurst({ durationSec: 0.7, freqs: [220, 277, 330], gain: 0.48 }),
);

// Short bright cheer stab
writeWav(
  path.join(outDir, "hell_yeah.wav"),
  toneBurst({
    durationSec: 0.55,
    freqs: [523.25, 659.25, 783.99],
    attack: 0.005,
    release: 0.2,
    gain: 0.4,
  }),
);

console.log("Wrote presets to", outDir);
