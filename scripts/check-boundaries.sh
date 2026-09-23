#!/usr/bin/env bash
# Deterministic boundary checks for Unloop (privacy + future Core isolation).
# Exit 0 = pass. Exit 1 = violations found.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

# Banned dependency / SDK name patterns (package.json and lockfiles).
BANNED_PATTERNS=(
  'firebase'
  '@sentry/'
  'sentry-expo'
  'amplitude'
  'mixpanel'
  'segment-analytics'
  '@segment/'
  'posthog'
  'telemetrydeck'
  'appcenter'
  'crashlytics'
  'google-analytics'
  '@react-native-firebase'
)

echo "==> Checking for banned telemetry/analytics patterns in package manifests..."
shopt -s nullglob
manifests=(package.json package-lock.json */package.json */*/package.json)
if [[ ${#manifests[@]} -eq 0 ]]; then
  echo "    (no package.json files yet — skip)"
else
  for pattern in "${BANNED_PATTERNS[@]}"; do
    if grep -R -n -i --include='package.json' --include='package-lock.json' -e "$pattern" . 2>/dev/null \
      | grep -v 'node_modules' \
      | grep -v './scripts/check-boundaries.sh' \
      | grep -q .; then
      echo "FAIL: banned pattern matched: $pattern"
      grep -R -n -i --include='package.json' --include='package-lock.json' -e "$pattern" . 2>/dev/null \
        | grep -v 'node_modules' || true
      fail=1
    fi
  done
fi

# When packages/core exists, forbid RN/Expo imports inside Core source.
if [[ -d packages/core ]]; then
  echo "==> Checking packages/core for React Native / Expo imports..."
  if grep -R -n -E "from ['\"]react-native['\"]|from ['\"]expo|require\\(['\"]react-native['\"]\\)|require\\(['\"]expo" \
    packages/core \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' 2>/dev/null \
    | grep -v '\.test\.' \
    | grep -q .; then
    echo "FAIL: packages/core must not import react-native or expo"
    grep -R -n -E "from ['\"]react-native['\"]|from ['\"]expo|require\\(['\"]react-native['\"]\\)|require\\(['\"]expo" \
      packages/core \
      --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' 2>/dev/null || true
    fail=1
  else
    echo "    OK (no RN/Expo imports in Core)"
  fi
else
  echo "==> packages/core not present yet — skip Core isolation check"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "==> Boundary check FAILED"
  exit 1
fi

echo "==> Boundary check PASSED"
exit 0
