#!/usr/bin/env bash
# Build a Play-ready AAB (release). Requires upload keystore (see create-upload-keystore.sh).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE="$ROOT/apps/mobile"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
# Prefer explicit override; otherwise force Temurin 17 (sdkman "current" may be too new for AGP/CMake).
DEFAULT_JAVA17="$HOME/Library/Java/JavaVirtualMachines/jdk-17.0.20.1+1/Contents/Home"
export JAVA_HOME="${UNLOOP_JAVA_HOME:-$DEFAULT_JAVA17}"
if [[ ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "JAVA_HOME not usable: $JAVA_HOME"
  echo "Install JDK 17 or set UNLOOP_JAVA_HOME."
  exit 1
fi
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
echo "Using JAVA_HOME=$JAVA_HOME ($("$JAVA_HOME/bin/java" -version 2>&1 | head -1))"

cd "$MOBILE"

if [[ ! -d android ]]; then
  echo "No android/ — running expo prebuild..."
  npx expo prebuild --platform android --no-install
fi

# Prefer env; else android/keystore.properties; else credentials next to example.
if [[ -z "${UNLOOP_UPLOAD_STORE_FILE:-}" && -f "$MOBILE/credentials/unloop-upload.jks" ]]; then
  export UNLOOP_UPLOAD_STORE_FILE="$MOBILE/credentials/unloop-upload.jks"
fi

if [[ -z "${UNLOOP_UPLOAD_STORE_FILE:-}" && ! -f "$MOBILE/android/keystore.properties" ]]; then
  echo "Missing upload keystore config."
  echo "Run ./scripts/android/create-upload-keystore.sh then set keystore.properties or UNLOOP_UPLOAD_* env."
  exit 1
fi

# If properties file missing but env set, write a transient properties for Gradle.
if [[ ! -f "$MOBILE/android/keystore.properties" && -n "${UNLOOP_UPLOAD_STORE_FILE:-}" ]]; then
  cat > "$MOBILE/android/keystore.properties" <<EOF
storeFile=${UNLOOP_UPLOAD_STORE_FILE}
storePassword=${UNLOOP_UPLOAD_STORE_PASSWORD:?set UNLOOP_UPLOAD_STORE_PASSWORD}
keyAlias=${UNLOOP_UPLOAD_KEY_ALIAS:-unloop-upload}
keyPassword=${UNLOOP_UPLOAD_KEY_PASSWORD:?set UNLOOP_UPLOAD_KEY_PASSWORD}
EOF
  echo "Wrote android/keystore.properties from env (gitignored via android/)."
fi

cd "$MOBILE/android"
./gradlew :app:bundleRelease

AAB="$MOBILE/android/app/build/outputs/bundle/release/app-release.aab"
echo
echo "AAB ready: $AAB"
ls -lh "$AAB"
echo "Upload this file to Play Console → Testing → Internal testing (or Closed)."
