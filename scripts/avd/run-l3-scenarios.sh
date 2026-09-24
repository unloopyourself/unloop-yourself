#!/usr/bin/env bash
# L3 AVD scenario harness — agent-runnable, local only.
# Prerequisites: emulator online (`adb devices` shows emulator-*), Metro optional for JS UI.
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

pass=0
fail=0
note() { echo "- $*" | tee -a "$REPORT"; }
ok() { echo "| $1 | PASS | $2 |" | tee -a "$REPORT"; pass=$((pass+1)); }
bad() { echo "| $1 | FAIL | $2 |" | tee -a "$REPORT"; fail=$((fail+1)); }

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

if [[ ! -f "$DUMMY_APK" ]]; then
  (cd "$ROOT/apps/dummy-target" && ./gradlew :app:assembleDebug) || exit 1
fi
if [[ ! -f "$UNLOOP_APK" ]]; then
  (cd "$ROOT/apps/mobile/android" && ./gradlew :app:assembleDebug) || exit 1
fi

adb -s "$EMU" install -r -t "$DUMMY_APK" >/dev/null
adb -s "$EMU" install -r -t "$UNLOOP_APK" >/dev/null
ok "install" "dummy+unloop"

adb -s "$EMU" shell appops set dev.unloopyourself.app GET_USAGE_STATS allow
adb -s "$EMU" shell appops set dev.unloopyourself.app SYSTEM_ALERT_WINDOW allow
ok "permissions" "usage+overlay via appops"

adb -s "$EMU" shell am force-stop dev.unloopyourself.app
adb -s "$EMU" shell am force-stop dev.unloopyourself.dummytarget
adb -s "$EMU" logcat -c

adb -s "$EMU" shell am start -n dev.unloopyourself.app/.MainActivity >/dev/null
sleep 4
adb -s "$EMU" shell am broadcast -p dev.unloopyourself.app \
  -a dev.unloopyourself.DEBUG_START_MONITOR \
  --es packages "dev.unloopyourself.dummytarget" \
  --el thresholdMs "$THRESHOLD_MS" >/dev/null

adb -s "$EMU" shell am start -n dev.unloopyourself.dummytarget/.MainActivity >/dev/null
WAIT=$((THRESHOLD_MS / 1000 + 8))
note "waiting ${WAIT}s for threshold with dummy in foreground"
sleep "$WAIT"

LOG="$(adb -s "$EMU" logcat -d | rg "THRESHOLD reached|interrupt overlay shown" | tail -5 || true)"
if echo "$LOG" | rg -q "THRESHOLD reached"; then
  ok "threshold_to_overlay" "$LOG"
else
  bad "threshold_to_overlay" "no THRESHOLD in logcat"
fi

# Open challenge
adb -s "$EMU" shell uiautomator dump /sdcard/uidump.xml >/dev/null
adb -s "$EMU" pull /sdcard/uidump.xml /tmp/unloop-uidump.xml >/dev/null
CENTER="$(python3 - <<'PY'
import re
xml=open("/tmp/unloop-uidump.xml").read()
m=re.search(r'text="Open challenge"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
if not m:
  print("")
else:
  x1,y1,x2,y2=map(int,m.groups())
  print(f"{(x1+x2)//2} {(y1+y2)//2}")
PY
)"
if [[ -n "$CENTER" ]]; then
  adb -s "$EMU" shell input tap $CENTER
  sleep 2
  TOP="$(adb -s "$EMU" shell dumpsys activity activities | rg -m1 topResumedActivity || true)"
  if echo "$TOP" | rg -q "dev.unloopyourself.app"; then
    ok "open_challenge_brings_unloop" "$TOP"
  else
    bad "open_challenge_brings_unloop" "$TOP"
  fi
else
  bad "open_challenge_brings_unloop" "Open challenge button not in UI dump"
fi

# Soft-fail: Skip for now (localized may vary — try English first)
adb -s "$EMU" shell uiautomator dump /sdcard/uidump.xml >/dev/null
adb -s "$EMU" pull /sdcard/uidump.xml /tmp/unloop-uidump.xml >/dev/null
SKIP="$(python3 - <<'PY'
import re
xml=open("/tmp/unloop-uidump.xml").read()
for label in ("Skip for now", "Salta per ora"):
  m=re.search(rf'text="{label}"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
  if m:
    x1,y1,x2,y2=map(int,m.groups())
    print(f"{(x1+x2)//2} {(y1+y2)//2}")
    break
PY
)"
if [[ -n "$SKIP" ]]; then
  adb -s "$EMU" shell input tap $SKIP
  sleep 2
  COOL="$(adb -s "$EMU" logcat -d | rg "armCooldownUntil|cooldown started|Cooldown —" | tail -3 || true)"
  # native may only show via notification; JS sets cooldown
  ok "soft_fail_skip_tapped" "coords=$SKIP $COOL"
else
  note "Skip control not visible (JS challenge UI may not have hydrated) — soft-fail covered in L0 SessionEngine"
fi

# Sensor inject probe (capability, not full shake complete)
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
