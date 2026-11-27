/**
 * Force low video quality + size limit on Android system camera intents.
 * OEM cameras (Nokia, Samsung, …) ignore ImagePicker `quality` for video.
 */
const path = require("path");
const { withDangerousMod, createRunOncePlugin } = require("@expo/config-plugins");

const PLUGIN_NAME = "withImagePickerVideoCaps";

function withImagePickerVideoCaps(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      // Re-apply after prebuild / dependency restore.
      require(path.join(
        cfg.modRequest.projectRoot,
        "scripts",
        "apply-image-picker-video-caps.js",
      ));
      return cfg;
    },
  ]);
}

module.exports = createRunOncePlugin(
  withImagePickerVideoCaps,
  PLUGIN_NAME,
  "1.0.0",
);
