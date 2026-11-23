/**
 * Expo config plugin: Play-oriented Android defaults that survive `prebuild --clean`.
 *
 * Also ships the brand splash: Expo SDK 57 templates leave a generic
 * adaptive-icon "target" placeholder as splashscreen_logo unless we overwrite it.
 */
const fs = require("fs");
const path = require("path");
const {
  withAppBuildGradle,
  withAndroidColors,
  withAndroidStyles,
  withDangerousMod,
  createRunOncePlugin,
} = require("@expo/config-plugins");
const { generateImageAsync } = require("@expo/image-utils");

const PLUGIN_NAME = "withUnloopAndroidRelease";

/** mdpi→xxxhdpi sizes used by the Expo Android template for splashscreen_logo. */
const SPLASH_LOGO_SIZES = [
  { folder: "drawable-mdpi", size: 288 },
  { folder: "drawable-hdpi", size: 432 },
  { folder: "drawable-xhdpi", size: 576 },
  { folder: "drawable-xxhdpi", size: 864 },
  { folder: "drawable-xxxhdpi", size: 1152 },
];

const SPLASHSCREEN_XML = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@color/splashscreen_background"/>
  <item>
    <bitmap android:gravity="center" android:src="@drawable/splashscreen_logo"/>
  </item>
</layer-list>
`;

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

/** Point the launch theme at a layer-list (bg + centered mark), not the raw logo. */
function withSplashTheme(config) {
  return withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults;
    const appGroup = styles.resources.style || [];
    for (const style of appGroup) {
      if (style.$.name !== "Theme.App.SplashScreen") {
        continue;
      }
      const items = style.item || [];
      let found = false;
      for (const item of items) {
        if (item.$.name === "android:windowBackground") {
          item._ = "@drawable/splashscreen";
          found = true;
        }
      }
      if (!found) {
        items.push({
          $: { name: "android:windowBackground" },
          _: "@drawable/splashscreen",
        });
        style.item = items;
      }
    }
    return cfg;
  });
}

function resolveSplashImage(projectRoot, config) {
  const rel =
    config.android?.splash?.image ||
    config.splash?.image ||
    "./assets/splash-icon.png";
  return path.resolve(projectRoot, rel);
}

function withBrandSplashImages(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const resRoot = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
      );
      const src = resolveSplashImage(projectRoot, cfg);
      if (!fs.existsSync(src)) {
        console.warn(
          `[${PLUGIN_NAME}] splash image missing at ${src} — leaving template logo`,
        );
        return cfg;
      }

      const drawableDir = path.join(resRoot, "drawable");
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.writeFileSync(path.join(drawableDir, "splashscreen.xml"), SPLASHSCREEN_XML);

      const cachePath = path.join(projectRoot, ".expo", "unloop-splash-cache");
      fs.mkdirSync(cachePath, { recursive: true });

      for (const { folder, size } of SPLASH_LOGO_SIZES) {
        const outDir = path.join(resRoot, folder);
        fs.mkdirSync(outDir, { recursive: true });
        const { source: buffer } = await generateImageAsync(
          { projectRoot, cacheType: "unloop-splash" },
          {
            src,
            width: size,
            height: size,
            resizeMode: "contain",
            backgroundColor: "transparent",
          },
        );
        fs.writeFileSync(path.join(outDir, "splashscreen_logo.png"), buffer);
      }

      return cfg;
    },
  ]);
}

function withUnloopAndroidRelease(config) {
  config = withVersionAndSigning(config);
  config = withSplashColors(config);
  config = withSplashTheme(config);
  config = withBrandSplashImages(config);
  return config;
}

module.exports = createRunOncePlugin(
  withUnloopAndroidRelease,
  PLUGIN_NAME,
  "1.1.0",
);
