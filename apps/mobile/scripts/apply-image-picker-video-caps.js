/**
 * Apply Android video quality/size extras to expo-image-picker CameraContract.
 * Safe to run repeatedly (idempotent). Used from postinstall + Expo config plugin.
 */
const fs = require("fs");
const path = require("path");

const contract = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo-image-picker",
  "android",
  "src",
  "main",
  "java",
  "expo",
  "modules",
  "imagepicker",
  "contracts",
  "CameraContract.kt",
);

const NEEDLE =
  "putExtra(MediaStore.EXTRA_DURATION_LIMIT, input.options.videoMaxDuration)";

const REPLACEMENT = `putExtra(MediaStore.EXTRA_DURATION_LIMIT, input.options.videoMaxDuration)
          // Unloop: low/MMS quality + size cap — OEMs often ignore ImagePicker quality.
          putExtra(MediaStore.EXTRA_VIDEO_QUALITY, 0)
          putExtra(MediaStore.EXTRA_SIZE_LIMIT, 6L * 1024L * 1024L)`;

function apply() {
  if (!fs.existsSync(contract)) {
    console.warn("[unloop] expo-image-picker CameraContract.kt not found — skip");
    return;
  }
  let src = fs.readFileSync(contract, "utf8");
  if (src.includes("EXTRA_VIDEO_QUALITY")) return;
  if (!src.includes(NEEDLE)) {
    console.warn("[unloop] CameraContract.kt needle missing — skip");
    return;
  }
  fs.writeFileSync(contract, src.replace(NEEDLE, REPLACEMENT));
  console.log("[unloop] patched expo-image-picker CameraContract video caps");
}

apply();
