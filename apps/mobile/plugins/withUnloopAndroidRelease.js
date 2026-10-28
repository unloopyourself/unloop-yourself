/**
 * Expo config plugin: Play-oriented Android defaults that survive `prebuild --clean`.
 */
const {
  withAppBuildGradle,
  withAndroidColors,
  createRunOncePlugin,
} = require("@expo/config-plugins");

const PLUGIN_NAME = "withUnloopAndroidRelease";

const SIGNING_SNIPPET = `
// --- Unloop Play upload signing (env or android/keystore.properties) ---
def unloopKeystorePropertiesFile = rootProject.file("keystore.properties")
def unloopKeystoreProperties = new Properties()
if (unloopKeystorePropertiesFile.exists()) {
    unloopKeystoreProperties.load(new FileInputStream(unloopKeystorePropertiesFile))
}
def unloopStoreFile = System.getenv("UNLOOP_UPLOAD_STORE_FILE") ?: unloopKeystoreProperties["storeFile"]
def unloopStorePassword = System.getenv("UNLOOP_UPLOAD_STORE_PASSWORD") ?: unloopKeystoreProperties["storePassword"]
def unloopKeyAlias = System.getenv("UNLOOP_UPLOAD_KEY_ALIAS") ?: unloopKeystoreProperties["keyAlias"]
def unloopKeyPassword = System.getenv("UNLOOP_UPLOAD_KEY_PASSWORD") ?: unloopKeystoreProperties["keyPassword"]
`;

function withVersionAndSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    const versionCode = config.android?.versionCode ?? 1;
    const versionName = config.version ?? "0.1.0";
    contents = contents.replace(
      /versionCode\s+\d+/,
      `versionCode ${versionCode}`,
    );
    contents = contents.replace(
      /versionName\s+"[^"]*"/,
      `versionName "${versionName}"`,
    );

    if (!contents.includes("debuggableVariants = []")) {
      contents = contents.replace(
        "autolinkLibrariesWithApp()",
        "// Embed JS in debug so devices run without Metro.\\n    debuggableVariants = []\\n\\n    autolinkLibrariesWithApp()",
      );
      // Fix double-escaped newlines from above if template used wrong
      contents = contents.replace(
        "// Embed JS in debug so devices run without Metro.\\n    debuggableVariants = []\\n\\n    autolinkLibrariesWithApp()",
        "// Embed JS in debug so devices run without Metro.\n    debuggableVariants = []\n\n    autolinkLibrariesWithApp()",
      );
    }

    if (!contents.includes("unloopStoreFile")) {
      contents = contents.replace(
        "android {",
        `${SIGNING_SNIPPET}\nandroid {`,
      );

      if (!contents.includes("signingConfigs.release") && contents.includes("signingConfigs {")) {
        contents = contents.replace(
          /signingConfigs \{\s*debug \{([\s\S]*?)\n        \}/,
          `signingConfigs {
        debug {$1
        }
        release {
            if (unloopStoreFile) {
                storeFile rootProject.file(unloopStoreFile)
                storePassword unloopStorePassword
                keyAlias unloopKeyAlias
                keyPassword unloopKeyPassword
            }
        }`,
        );
      }

      contents = contents.replace(
        /release \{\s*\/\/ Caution![\s\S]*?signingConfig signingConfigs\.debug/,
        `release {
            if (unloopStoreFile) {
                signingConfig signingConfigs.release
            } else {
                // Local fallback only — do not upload a debug-signed AAB to Play.
                signingConfig signingConfigs.debug
            }`,
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

function withSplashColors(config) {
  const bg =
    config.android?.splash?.backgroundColor ||
    config.splash?.backgroundColor ||
    "#0A2540";

  return withAndroidColors(config, (cfg) => {
    const colors = cfg.modResults;
    const items = colors.resources.color || [];
    let found = false;
    for (const item of items) {
      if (item.$.name === "splashscreen_background") {
        item._ = bg;
        found = true;
      }
    }
    if (!found) {
      items.push({ $: { name: "splashscreen_background" }, _: bg });
      colors.resources.color = items;
    }
    return cfg;
  });
}

function withUnloopAndroidRelease(config) {
  config = withVersionAndSigning(config);
  config = withSplashColors(config);
  return config;
}

module.exports = createRunOncePlugin(
  withUnloopAndroidRelease,
  PLUGIN_NAME,
  "1.0.0",
);
