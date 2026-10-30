#!/usr/bin/env bash
# Create a Play upload keystore (local only — never commit the .jks).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="$ROOT/apps/mobile/credentials"
OUT_JKS="$OUT_DIR/unloop-upload.jks"
ALIAS="${UNLOOP_UPLOAD_KEY_ALIAS:-unloop-upload}"

mkdir -p "$OUT_DIR"
if [[ -f "$OUT_JKS" ]]; then
  echo "Keystore already exists: $OUT_JKS"
  echo "Refusing to overwrite. Delete it first if you intend to rotate."
  exit 1
fi

echo "Creating upload keystore at $OUT_JKS"
echo "You will be prompted for passwords and certificate fields."
keytool -genkeypair -v \
  -storetype JKS \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias "$ALIAS" \
  -keystore "$OUT_JKS"

cat <<EOF

Next:
1. Create apps/mobile/android/keystore.properties (after prebuild) from
   apps/mobile/keystore.properties.example with:
     storeFile=../credentials/unloop-upload.jks
     storePassword=...
     keyAlias=$ALIAS
     keyPassword=...
2. Or export:
     UNLOOP_UPLOAD_STORE_FILE=$OUT_JKS
     UNLOOP_UPLOAD_STORE_PASSWORD=...
     UNLOOP_UPLOAD_KEY_ALIAS=$ALIAS
     UNLOOP_UPLOAD_KEY_PASSWORD=...
3. Run: ./scripts/android/build-play-aab.sh
4. Keep a secure offline backup of the .jks + passwords (Play upload key loss is painful).

EOF
