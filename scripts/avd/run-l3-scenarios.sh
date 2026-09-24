#!/usr/bin/env bash
# L3 AVD scenario harness — agent-runnable, local only.
# Prerequisites: emulator online (`adb devices` shows emulator-*).
# Debug APK embeds JS (debuggableVariants=[]) so Metro is optional.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

EMU="${UNLOOP_EMU:-$(adb devices | awk '/emulator-.*device$/{print $1; exit}')}"
if [[ -z "${EMU}" ]]; then
  echo "FAIL: no emulator device. Start AVD unloop_api34 first." >&2
  exit 1
fi

DUMMY_APK="$ROOT/apps/dummy-target/app/build/outputs/apk/debug/app-debug.apk"
UNLOOP_APK="$ROOT/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
THRESHOLD_MS="${THRESHOLD_MS:-10000}"
REPORT_DIR="$ROOT/factory/l3-reports"
mkdir -p "$REPORT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT="$REPORT_DIR/scenario_${STAMP}.md"
UIDUMP=/tmp/unloop-uidump.xml

pass=0
fail=0
note() { echo "- $*" | tee -a "$REPORT"; }
ok() { echo "| $1 | PASS | $2 |" | tee -a "$REPORT"; pass=$((pass+1)); }
bad() { echo "| $1 | FAIL | $2 |" | tee -a "$REPORT"; fail=$((fail+1)); }

dump_ui() {
  adb -s "$EMU" shell uiautomator dump /sdcard/uidump.xml >/dev/null
  adb -s "$EMU" pull /sdcard/uidump.xml "$UIDUMP" >/dev/null
}

tap_text() {
  local label="$1"
  python3 - "$UIDUMP" "$label" <<'PY'
import re, sys
xml=open(sys.argv[1]).read()
label=sys.argv[2]
# Prefer resource-id / testID matches for reliable taps.
rid = re.escape(label.lower().replace(" ", "-"))
for pat in (
  rf'resource-id="[^"]*{rid}"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
  rf'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*resource-id="[^"]*{rid}"',
):
  m=re.search(pat, xml)
  if m:
    x1,y1,x2,y2=map(int,m.groups())
    print(f"{(x1+x2)//2} {(y1+y2)//2}")
    sys.exit(0)
esc=re.escape(label)
for pat in (
  rf'(?:text|content-desc)="{esc}"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
  rf'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*(?:text|content-desc)="{esc}"',
):
  m=re.search(pat, xml)
  if m:
    x1,y1,x2,y2=map(int,m.groups())
    print(f"{(x1+x2)//2} {(y1+y2)//2}")
    sys.exit(0)
sys.exit(1)
PY
}

wait_text() {
  local label="$1"
  local seconds="${2:-40}"
  local i
  for ((i=0; i<seconds; i++)); do
    dump_ui || true
    if tap_text "$label" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_monitor() {
  local force="${1:-}"
  adb -s "$EMU" shell am force-stop dev.unloopyourself.app
  adb -s "$EMU" shell am force-stop dev.unloopyourself.dummytarget
  adb -s "$EMU" logcat -c
  adb -s "$EMU" shell am start -n dev.unloopyourself.app/.MainActivity >/dev/null
  sleep 8
  if [[ -n "$force" ]]; then
    adb -s "$EMU" shell am broadcast -p dev.unloopyourself.app \
      -a dev.unloopyourself.DEBUG_START_MONITOR \
      --es packages "dev.unloopyourself.dummytarget" \
      --el thresholdMs "$THRESHOLD_MS" \
      --es forceChallenge "$force" >/dev/null
  else
    adb -s "$EMU" shell am broadcast -p dev.unloopyourself.app \
      -a dev.unloopyourself.DEBUG_START_MONITOR \
      --es packages "dev.unloopyourself.dummytarget" \
      --el thresholdMs "$THRESHOLD_MS" >/dev/null
  fi
  adb -s "$EMU" shell am start -n dev.unloopyourself.dummytarget/.MainActivity >/dev/null
  local wait=$((THRESHOLD_MS / 1000 + 8))
  note "waiting ${wait}s for threshold (forceChallenge=${force:-none})"
  sleep "$wait"
}

open_challenge() {
  if ! wait_text "Open challenge" 15; then
    return 1
  fi
  local coords
  coords="$(tap_text "Open challenge")"
  adb -s "$EMU" shell input tap $coords
  local i
  for ((i=0; i<25; i++)); do
    sleep 1
    local top
    top="$(adb -s "$EMU" shell dumpsys activity activities | rg -m1 topResumedActivity || true)"
    if ! echo "$top" | rg -q "dev.unloopyourself.app"; then
      continue
    fi
    dump_ui || true
    if tap_text "Open challenge" >/dev/null 2>&1; then
      coords="$(tap_text "Open challenge")"
      adb -s "$EMU" shell input tap $coords
      continue
    fi
    if tap_text "Skip for now" >/dev/null 2>&1 || tap_text "Salta per ora" >/dev/null 2>&1; then
      return 0
    fi
    if tap_text "breath-tap" >/dev/null 2>&1 || tap_text "Breathe tap" >/dev/null 2>&1; then
      return 0
    fi
    if adb -s "$EMU" logcat -d | rg -q "harness: enter_challenge:"; then
      return 0
    fi
  done
  return 1
}

inject_shake() {
  local i
  # Oscillate acceleration so |mag-1g| stays above shake threshold on emulator sensors.
  for ((i=0; i<70; i++)); do
    if (( i % 2 == 0 )); then
      adb -s "$EMU" emu sensor set acceleration 4:3:2 >/dev/null || true
    else
      adb -s "$EMU" emu sensor set acceleration 0.2:0.1:1.0 >/dev/null || true
    fi
    sleep 0.1
  done
  adb -s "$EMU" emu sensor set acceleration 0:0:9.8 >/dev/null || true
}

{
  echo "# L3 scenario run $STAMP"
  echo
  echo "EMU=$EMU THRESHOLD_MS=$THRESHOLD_MS"
  echo
  echo "| Step | Result | Detail |"
  echo "|------|--------|--------|"
} >"$REPORT"

adb -s "$EMU" wait-for-device
adb -s "$EMU" reverse tcp:8081 tcp:8081 >/dev/null || true
adb -s "$EMU" shell wm dismiss-keyguard >/dev/null || true

if [[ ! -f "$DUMMY_APK" ]]; then
  (cd "$ROOT/apps/dummy-target" && ./gradlew :app:assembleDebug) || exit 1
fi
if [[ ! -f "$UNLOOP_APK" ]] || [[ "${REBUILD:-}" == "1" ]]; then
  GRADLE="$ROOT/apps/mobile/android/app/build.gradle"
  if [[ -f "$GRADLE" ]] && ! rg -q 'debuggableVariants = \[\]' "$GRADLE"; then
    # android/ is gitignored (Expo prebuild); ensure debug APK embeds JS for L3 without Metro.
    perl -0pi -e 's/\/\* Variants \*\/\n(?:.*\n)*?(\s*)\/\* Bundling \*\//\/* Variants *\/\n    debuggableVariants = []\n\n    \/* Bundling *\//s' "$GRADLE" || true
  fi
  (cd "$ROOT/apps/mobile/android" && ./gradlew :app:assembleDebug) || exit 1
fi

adb -s "$EMU" install -r -t "$DUMMY_APK" >/dev/null
adb -s "$EMU" install -r -t "$UNLOOP_APK" >/dev/null
ok "install" "dummy+unloop"

adb -s "$EMU" shell appops set dev.unloopyourself.app GET_USAGE_STATS allow
adb -s "$EMU" shell appops set dev.unloopyourself.app SYSTEM_ALERT_WINDOW allow
ok "permissions" "usage+overlay via appops"

# --- soft-fail Skip E2E (run first on a clean process) ---
start_monitor "breath_tap"
LOG="$(adb -s "$EMU" logcat -d | rg "THRESHOLD reached|interrupt overlay shown" | tail -5 || true)"
if echo "$LOG" | rg -q "THRESHOLD reached"; then
  ok "threshold_to_overlay" "$LOG"
else
  bad "threshold_to_overlay" "no THRESHOLD in logcat"
fi

if open_challenge; then
  TOP="$(adb -s "$EMU" shell dumpsys activity activities | rg -m1 topResumedActivity || true)"
  ok "open_challenge_brings_unloop" "$TOP"
else
  bad "open_challenge_brings_unloop" "Open challenge failed"
fi

SKIP_FOUND=0
for label in "Skip for now" "Salta per ora"; do
  if wait_text "$label" 25; then
    SKIP="$(tap_text "$label")"
    adb -s "$EMU" shell input tap $SKIP
    sleep 2
    HARNESS="$(adb -s "$EMU" logcat -d | rg "harness: cooldown_soft_fail" | tail -3 || true)"
    if echo "$HARNESS" | rg -q "harness: cooldown_soft_fail"; then
      ok "soft_fail_skip_e2e" "$HARNESS"
    else
      bad "soft_fail_skip_e2e" "Skip tapped but no cooldown_soft_fail: $(adb -s "$EMU" logcat -d | rg 'harness:' | tail -5 || true)"
    fi
    SKIP_FOUND=1
    break
  fi
done
if [[ "$SKIP_FOUND" -eq 0 ]]; then
  dump_ui || true
  note "ui dump snippet: $(rg -o 'text=\"[^\"]+\"' "$UIDUMP" 2>/dev/null | head -40 | tr '\n' ' ')"
  bad "soft_fail_skip_e2e" "Skip control not visible after Open"
fi

adb -s "$EMU" shell am broadcast -p dev.unloopyourself.app -a dev.unloopyourself.DEBUG_STOP_MONITOR >/dev/null || true
adb -s "$EMU" shell am force-stop dev.unloopyourself.app
adb -s "$EMU" shell pm clear dev.unloopyourself.app >/dev/null
adb -s "$EMU" shell appops set dev.unloopyourself.app GET_USAGE_STATS allow
adb -s "$EMU" shell appops set dev.unloopyourself.app SYSTEM_ALERT_WINDOW allow
sleep 2

# --- challenge complete E2E via breath_tap ---
start_monitor "breath_tap"
if ! echo "$(adb -s "$EMU" logcat -d)" | rg -q "THRESHOLD reached"; then
  bad "complete_threshold" "no THRESHOLD for complete path"
else
  ok "complete_threshold" "THRESHOLD for complete path"
fi

if ! open_challenge; then
  bad "complete_open" "Open challenge failed before complete"
else
  ok "complete_open" "Unloop open for complete"
fi

ENTER="$(adb -s "$EMU" logcat -d | rg "harness: enter_challenge:" | tail -1 || true)"
note "challenge enter: $ENTER"

BREATH_TAP_LABEL=""
for label in "breath-tap" "Breathe tap" "Tap on exhale" "Tocca all’espirazione"; do
  if wait_text "$label" 15; then
    BREATH_TAP_LABEL="$label"
    break
  fi
done
if [[ -n "$BREATH_TAP_LABEL" ]]; then
  for _ in 1 2 3; do
    dump_ui || true
    COORDS="$(tap_text "$BREATH_TAP_LABEL")"
    note "breath tap $_ at $COORDS ($BREATH_TAP_LABEL)"
    adb -s "$EMU" shell input tap $COORDS
    sleep 0.7
  done
  sleep 2
  HARNESS="$(adb -s "$EMU" logcat -d | rg "harness: cooldown_completed" | tail -3 || true)"
  if echo "$HARNESS" | rg -q "harness: cooldown_completed"; then
    ok "challenge_complete_e2e" "$HARNESS"
  else
    bad "challenge_complete_e2e" "3 taps on '$BREATH_TAP_LABEL' but no cooldown_completed: $(adb -s "$EMU" logcat -d | rg 'harness:' | tail -8 || true)"
  fi
else
  dump_ui || true
  note "ui texts: $(rg -o 'text=\"[^\"]+\"|content-desc=\"[^\"]+\"|resource-id=\"[^\"]+\"' "$UIDUMP" 2>/dev/null | head -50 | tr '\n' ' ')"
  bad "challenge_complete_e2e" "breath tap control not visible ($ENTER)"
fi

adb -s "$EMU" shell am broadcast -p dev.unloopyourself.app -a dev.unloopyourself.DEBUG_STOP_MONITOR >/dev/null || true
adb -s "$EMU" shell am force-stop dev.unloopyourself.app
adb -s "$EMU" shell pm clear dev.unloopyourself.app >/dev/null
adb -s "$EMU" shell appops set dev.unloopyourself.app GET_USAGE_STATS allow
adb -s "$EMU" shell appops set dev.unloopyourself.app SYSTEM_ALERT_WINDOW allow
sleep 2

# --- shake complete E2E (best-effort: emu sensor→expo may not bridge) ---
start_monitor "shake"
if echo "$(adb -s "$EMU" logcat -d)" | rg -q "THRESHOLD reached" && open_challenge; then
  if wait_text "Shake to come back" 20 || wait_text "Scuoti per tornare" 5; then
    note "shake UI visible — injecting oscillating accelerometer"
    adb -s "$EMU" logcat -c
    inject_shake
    sleep 2
    HARNESS="$(adb -s "$EMU" logcat -d | rg "harness: cooldown_" | tail -3 || true)"
    if echo "$HARNESS" | rg -q "harness: cooldown_completed"; then
      ok "shake_complete_e2e" "$HARNESS"
    else
      note "PARTIAL shake_complete_e2e: sensor inject did not complete challenge ($HARNESS). L0 owns shake semantics; L4 for human motor feel."
    fi
  else
    note "PARTIAL shake_complete_e2e: shake UI not visible"
  fi
else
  note "PARTIAL shake_complete_e2e: could not reach shake challenge"
fi

# Sensor inject capability (always assert emu accepts values)
adb -s "$EMU" emu sensor set acceleration 9:2:1 >/dev/null
GOT="$(adb -s "$EMU" emu sensor get acceleration | tr -d '\r')"
if echo "$GOT" | rg -q "9:2:1"; then
  ok "sensor_accel_inject" "$GOT"
else
  bad "sensor_accel_inject" "$GOT"
fi
adb -s "$EMU" emu sensor set acceleration 0:0:9.8 >/dev/null

adb -s "$EMU" shell am broadcast -p dev.unloopyourself.app -a dev.unloopyourself.DEBUG_STOP_MONITOR >/dev/null || true

{
  echo
  echo "## Summary"
  echo "pass=$pass fail=$fail"
} | tee -a "$REPORT"

echo "Report: $REPORT"
[[ "$fail" -eq 0 ]]
