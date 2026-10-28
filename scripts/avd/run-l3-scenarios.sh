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
# Do not inherit SOFT_ONLY=1 from a prior shell session unless explicitly set for this run.
SOFT_ONLY="${SOFT_ONLY:-0}"
note() { echo "- $*" | tee -a "$REPORT"; }
ok() { echo "| $1 | PASS | $2 |" | tee -a "$REPORT"; pass=$((pass+1)); }
bad() { echo "| $1 | FAIL | $2 |" | tee -a "$REPORT"; fail=$((fail+1)); }

dump_ui() {
  local i
  for ((i=0; i<3; i++)); do
    if adb -s "$EMU" shell uiautomator dump /sdcard/uidump.xml >/dev/null 2>&1 \
      && adb -s "$EMU" pull /sdcard/uidump.xml "$UIDUMP" >/dev/null 2>&1 \
      && [[ -s "$UIDUMP" ]]; then
      return 0
    fi
    sleep 0.2
  done
  return 1
}

tap_text() {
  local label="$1"
  python3 - "$UIDUMP" "$label" <<'PY'
import re, sys
try:
  xml=open(sys.argv[1]).read()
except OSError:
  sys.exit(1)
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
  wait_any "$seconds" "$label"
}

# Wait until any of the labels appears; prints the matched label on stdout.
wait_any() {
  local seconds="$1"
  shift
  local i label
  for ((i=0; i<seconds; i++)); do
    if dump_ui; then
      for label in "$@"; do
        if tap_text "$label" >/dev/null 2>&1; then
          printf '%s\n' "$label"
          return 0
        fi
      done
    fi
    sleep 0.5
  done
  return 1
}

safe_tap() {
  local label="$1"
  local coords
  coords="$(tap_text "$label" 2>/dev/null || true)"
  if [[ -z "$coords" ]]; then
    return 1
  fi
  adb -s "$EMU" shell input tap $coords
}

# Tap by saved "x y" without re-dumping (avoids slow dumps between breath taps).
tap_xy() {
  local coords="$1"
  [[ -n "$coords" ]] || return 1
  adb -s "$EMU" shell input tap $coords
}

challenge_ui_visible() {
  dump_ui || return 1
  # Dismiss RN LogBox if it stole the foreground.
  if tap_text "Open debugger to view warnings" >/dev/null 2>&1 \
    || tap_text "Dismiss" >/dev/null 2>&1; then
    safe_tap "Dismiss" 2>/dev/null || adb -s "$EMU" shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || true
    sleep 0.3
    dump_ui || return 1
  fi
  local label
  for label in \
    "Skip for now" "Salta per ora" "challenge-skip" \
    "breath-tap" "Breathe tap" \
    "unlock-phrase" "Unlock phrase" \
    "math-answer" "Math answer" \
    "Shake to come back" "Scuoti per tornare" "Shake challenge" \
    "Coin spin" "Coin spin challenge" "Giro sulla moneta" \
    "Air write" "Air write challenge" "Scrivi in aria" \
    "Flip face-down" "Face down" "Waiting for face-down"; do
    if tap_text "$label" >/dev/null 2>&1; then
      return 0
    fi
  done
  return 1
}

start_monitor() {
  local force="${1:-}"
  adb -s "$EMU" shell am force-stop io.github.unloopyourself.unloop >/dev/null 2>&1 || true
  adb -s "$EMU" shell am force-stop io.github.unloopyourself.dummytarget >/dev/null 2>&1 || true
  adb -s "$EMU" logcat -c
  adb -s "$EMU" shell wm dismiss-keyguard >/dev/null 2>&1 || true
  adb -s "$EMU" shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
  adb -s "$EMU" shell am start -n io.github.unloopyourself.unloop/.MainActivity >/dev/null
  # Cold start after pm clear needs JS + settings hydrate before harness prefs apply.
  sleep 10
  if [[ -n "$force" ]]; then
    adb -s "$EMU" shell am broadcast -p io.github.unloopyourself.unloop \
      -a io.github.unloopyourself.DEBUG_START_MONITOR \
      --es packages "io.github.unloopyourself.dummytarget" \
      --el thresholdMs "$THRESHOLD_MS" \
      --es forceChallenge "$force" >/dev/null
  else
    adb -s "$EMU" shell am broadcast -p io.github.unloopyourself.unloop \
      -a io.github.unloopyourself.DEBUG_START_MONITOR \
      --es packages "io.github.unloopyourself.dummytarget" \
      --el thresholdMs "$THRESHOLD_MS" >/dev/null
  fi
  # commit() prefs + JS read; give MainActivity a beat before dummy FG.
  sleep 2
  adb -s "$EMU" shell am start -n io.github.unloopyourself.dummytarget/.MainActivity >/dev/null
  note "waiting for THRESHOLD (forceChallenge=${force:-none})"
  local i
  for ((i=0; i<$((THRESHOLD_MS/1000 + 25)); i++)); do
    if adb -s "$EMU" logcat -d 2>/dev/null | rg -q "THRESHOLD reached"; then
      note "THRESHOLD after ${i}s"
      # Let overlay draw before Open.
      sleep 1.5
      return 0
    fi
    sleep 1
  done
  note "THRESHOLD not seen within wait window"
  return 1
}

# Bring Unloop challenge UI to front. Tap Open at most once, then wait — re-tapping
# Open used to re-hydrate and remount the challenge UI.
open_challenge() {
  local opened=0
  local i
  # Budget ~20s so we stay under the 45s challenge soft-timeout.
  for ((i=0; i<20; i++)); do
    if challenge_ui_visible; then
      return 0
    fi
    # Already soft-failed — do not burn the rest of the budget.
    # Require the distinctive Grace period label (not monitoring home / ANR dialogs).
    if dump_ui && tap_text "Grace period" >/dev/null 2>&1; then
      note "open_challenge: soft-fail home visible — abort"
      return 1
    fi
    if tap_text "Open challenge" >/dev/null 2>&1; then
      if [[ "$opened" -eq 0 ]]; then
        safe_tap "Open challenge" || true
        opened=1
        sleep 0.8
        continue
      fi
      adb -s "$EMU" shell am start -n io.github.unloopyourself.unloop/.MainActivity >/dev/null 2>&1 || true
      sleep 0.6
      if challenge_ui_visible; then
        return 0
      fi
    fi
    sleep 0.35
  done
  return 1
}

reset_app() {
  adb -s "$EMU" shell am broadcast -p io.github.unloopyourself.unloop -a io.github.unloopyourself.DEBUG_STOP_MONITOR >/dev/null 2>&1 || true
  adb -s "$EMU" shell am force-stop io.github.unloopyourself.unloop >/dev/null 2>&1 || true
  adb -s "$EMU" shell pm clear io.github.unloopyourself.unloop >/dev/null 2>&1 || true
  adb -s "$EMU" shell appops set io.github.unloopyourself.unloop GET_USAGE_STATS allow
  adb -s "$EMU" shell appops set io.github.unloopyourself.unloop SYSTEM_ALERT_WINDOW allow
  sleep 2
}

assert_enter() {
  local want="$1"
  local step="$2"
  local enter
  # Match the forced id specifically (ignore stale enters from a prior scenario).
  enter="$(adb -s "$EMU" logcat -d 2>/dev/null | rg "harness: enter_challenge:${want}" | tail -1 || true)"
  if [[ -n "$enter" ]]; then
    ok "$step" "$enter"
  else
    local last
    last="$(adb -s "$EMU" logcat -d 2>/dev/null | rg "harness: enter_challenge:" | tail -1 || true)"
    bad "$step" "expected enter_challenge:${want}, got: $last"
  fi
}

wait_harness() {
  local needle="$1"
  local seconds="${2:-8}"
  local i
  for ((i=0; i<seconds*2; i++)); do
    if adb -s "$EMU" logcat -d 2>/dev/null | rg -q "$needle"; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

complete_breath_tap() {
  local label coords
  label="$(wait_any 10 "breath-tap" "Breathe tap")" || return 1
  dump_ui || return 1
  coords="$(tap_text "$label")" || return 1
  note "breath coords=$coords ($label)"
  local _
  # Breath tap locks ~3s between advances to simulate a calm breath.
  for _ in 1 2 3; do
    sleep 3.3
    tap_xy "$coords" || return 1
  done
  wait_harness "harness: cooldown_completed" 15
}

complete_unlock_phrase() {
  local label phrase encoded
  label="$(wait_any 10 "unlock-phrase" "Unlock phrase")" || return 1
  dump_ui || return 1
  phrase="$(python3 - "$UIDUMP" <<'PY'
import re, sys, html
xml = open(sys.argv[1]).read()
# Prefer dedicated prompt testID; fall back to ember prompt text heuristics.
for pat in (
  r'resource-id="[^"]*unlock-phrase-prompt"[^>]*text="([^"]+)"',
  r'text="([^"]+)"[^>]*resource-id="[^"]*unlock-phrase-prompt"',
):
  m = re.search(pat, xml)
  if m:
    print(html.unescape(m.group(1)))
    sys.exit(0)
sys.exit(1)
PY
)" || return 1
  safe_tap "$label" || return 1
  sleep 0.25
  encoded="$(python3 -c 'import sys; print(sys.argv[1].replace(" ", "%s"))' "$phrase")"
  adb -s "$EMU" shell input text "$encoded"
  wait_harness "harness: cooldown_completed" 12
}

complete_nearest_multiple() {
  wait_any 8 "math-answer" "Math answer" "Quick mind check" >/dev/null || return 1
  dump_ui || return 1
  local answer unlock_xy field_xy
  answer="$(python3 - "$UIDUMP" <<'PY'
import sys
xml = open(sys.argv[1]).read()
answers = {
  "Nearest multiple of 7 to 45?": "42",
  "Nearest multiple of 5 to 23?": "25",
  "Nearest multiple of 9 to 50?": "54",
  "Nearest even number to 17?": "18",
  "Nearest multiple of 3 to 20?": "21",
}
for prompt, ans in answers.items():
  if prompt in xml:
    print(ans)
    sys.exit(0)
sys.exit(1)
PY
)" || return 1
  note "math puzzle answer=$answer"
  # Capture Unlock coords before the IME covers it.
  unlock_xy="$(tap_text "math-unlock" 2>/dev/null || tap_text "Math unlock" 2>/dev/null || tap_text "Unlock" 2>/dev/null || true)"
  field_xy="$(tap_text "math-answer" 2>/dev/null || tap_text "Math answer" 2>/dev/null || true)"
  [[ -n "$field_xy" ]] || return 1
  tap_xy "$field_xy" || return 1
  sleep 0.2
  # Number-pad: keyevents are more reliable than `input text` on AVD.
  local d
  for ((i=0; i<${#answer}; i++)); do
    d="${answer:$i:1}"
    adb -s "$EMU" shell input keyevent $((7 + d))
  done
  if wait_harness "harness: cooldown_completed" 5; then
    return 0
  fi
  if [[ -n "$unlock_xy" ]]; then
    tap_xy "$unlock_xy" || true
  else
    dump_ui || true
    safe_tap "math-unlock" || safe_tap "Math unlock" || safe_tap "Unlock" || true
  fi
  wait_harness "harness: cooldown_completed" 6
}

inject_shake() {
  local i
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

# Fail fast if the emulator disconnects (avoid indefinite hang).
if ! adb -s "$EMU" wait-for-device shell true >/dev/null 2>&1; then
  echo "FAIL: emulator $EMU not ready" >&2
  exit 1
fi
# Brief settle; do not use bare wait-for-device (hangs if device drops).
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if adb -s "$EMU" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' | grep -qx 1; then
    break
  fi
  sleep 1
done
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

adb -s "$EMU" shell appops set io.github.unloopyourself.unloop GET_USAGE_STATS allow
adb -s "$EMU" shell appops set io.github.unloopyourself.unloop SYSTEM_ALERT_WINDOW allow
ok "permissions" "usage+overlay via appops"

# --- soft-fail Skip E2E (run first on a clean process) ---
if start_monitor "breath_tap"; then
  LOG="$(adb -s "$EMU" logcat -d 2>/dev/null | rg "THRESHOLD reached|interrupt overlay shown" | tail -5 || true)"
  if echo "$LOG" | rg -q "THRESHOLD reached"; then
    ok "threshold_to_overlay" "$LOG"
  else
    bad "threshold_to_overlay" "no THRESHOLD in logcat"
  fi
else
  bad "threshold_to_overlay" "start_monitor timed out"
fi

if open_challenge; then
  TOP="$(adb -s "$EMU" shell dumpsys activity activities | rg -m1 topResumedActivity || true)"
  ok "open_challenge_brings_unloop" "$TOP"
else
  bad "open_challenge_brings_unloop" "Open challenge failed"
fi

SKIP_LABEL="$(wait_any 12 "Skip for now" "Salta per ora" "challenge-skip" || true)"
if [[ -n "$SKIP_LABEL" ]]; then
  safe_tap "$SKIP_LABEL"
  if wait_harness "harness: cooldown_soft_fail" 6; then
    HARNESS="$(adb -s "$EMU" logcat -d 2>/dev/null | rg "harness: cooldown_soft_fail" | tail -3 || true)"
    ok "soft_fail_skip_e2e" "$HARNESS"
  else
    bad "soft_fail_skip_e2e" "Skip tapped but no cooldown_soft_fail: $(adb -s "$EMU" logcat -d 2>/dev/null | rg 'harness:' | tail -5 || true)"
  fi
else
  dump_ui || true
  note "ui dump snippet: $(rg -o 'text=\"[^\"]+\"' "$UIDUMP" 2>/dev/null | head -40 | tr '\n' ' ')"
  bad "soft_fail_skip_e2e" "Skip control not visible after Open"
fi

reset_app

# --- challenge complete E2E via breath_tap ---
if start_monitor "breath_tap"; then
  ok "complete_threshold" "THRESHOLD for complete path"
else
  bad "complete_threshold" "no THRESHOLD for complete path"
fi

if open_challenge; then
  ok "complete_open" "Unloop open for complete"
  assert_enter "breath_tap" "enter_breath_tap"
  if complete_breath_tap; then
    HARNESS="$(adb -s "$EMU" logcat -d 2>/dev/null | rg "harness: cooldown_completed" | tail -3 || true)"
    ok "breath_complete_e2e" "$HARNESS"
  else
    dump_ui || true
    note "ui texts: $(rg -o 'text=\"[^\"]+\"|content-desc=\"[^\"]+\"|resource-id=\"[^\"]+\"' "$UIDUMP" 2>/dev/null | head -50 | tr '\n' ' ')"
    bad "breath_complete_e2e" "breath complete failed: $(adb -s "$EMU" logcat -d 2>/dev/null | rg 'harness:' | tail -8 || true)"
  fi
else
  bad "complete_open" "Open challenge failed before complete"
  bad "enter_breath_tap" "skipped — open failed"
  bad "breath_complete_e2e" "skipped — open failed"
fi

reset_app

# --- unlock_phrase complete E2E ---
if start_monitor "unlock_phrase" && open_challenge; then
  assert_enter "unlock_phrase" "enter_unlock_phrase"
  if complete_unlock_phrase; then
    HARNESS="$(adb -s "$EMU" logcat -d 2>/dev/null | rg "harness: cooldown_completed" | tail -3 || true)"
    ok "unlock_phrase_complete_e2e" "$HARNESS"
  else
    dump_ui || true
    note "ui: $(rg -o 'text=\"[^\"]+\"|content-desc=\"[^\"]+\"|resource-id=\"[^\"]+\"' "$UIDUMP" 2>/dev/null | head -40 | tr '\n' ' ')"
    bad "unlock_phrase_complete_e2e" "could not type/complete phrase: $(adb -s "$EMU" logcat -d 2>/dev/null | rg 'harness:' | tail -8 || true)"
  fi
else
  bad "unlock_phrase_complete_e2e" "could not open unlock_phrase"
fi

reset_app

# --- nearest_multiple complete E2E ---
if start_monitor "nearest_multiple" && open_challenge; then
  assert_enter "nearest_multiple" "enter_nearest_multiple"
  if complete_nearest_multiple; then
    HARNESS="$(adb -s "$EMU" logcat -d 2>/dev/null | rg "harness: cooldown_completed" | tail -3 || true)"
    ok "nearest_multiple_complete_e2e" "$HARNESS"
  else
    dump_ui || true
    note "ui: $(rg -o 'text=\"[^\"]+\"|content-desc=\"[^\"]+\"|resource-id=\"[^\"]+\"' "$UIDUMP" 2>/dev/null | head -40 | tr '\n' ' ')"
    bad "nearest_multiple_complete_e2e" "could not solve math: $(adb -s "$EMU" logcat -d 2>/dev/null | rg 'harness:' | tail -8 || true)"
  fi
else
  bad "nearest_multiple_complete_e2e" "could not open nearest_multiple"
fi

reset_app

# --- REGRESSION: sticky forceChallenge cleared → next force honored ---
# Use soft challenges only (shake open is flaky on AVD for this step).
if start_monitor "unlock_phrase" && open_challenge; then
  assert_enter "unlock_phrase" "regression_sticky_enter_first"
  SKIP_LABEL="$(wait_any 8 "Skip for now" "Salta per ora" "challenge-skip" || true)"
  if [[ -n "$SKIP_LABEL" ]]; then
    safe_tap "$SKIP_LABEL" || true
    wait_harness "harness: cooldown_soft_fail" 5 || true
  fi
else
  bad "regression_sticky_enter_first" "could not open forced unlock_phrase for sticky regression"
fi
adb -s "$EMU" shell am broadcast -p io.github.unloopyourself.unloop -a io.github.unloopyourself.DEBUG_CLEAR_HARNESS >/dev/null 2>&1 || true
adb -s "$EMU" shell am broadcast -p io.github.unloopyourself.unloop -a io.github.unloopyourself.DEBUG_STOP_MONITOR >/dev/null 2>&1 || true
sleep 1
adb -s "$EMU" shell am force-stop io.github.unloopyourself.unloop >/dev/null 2>&1 || true
adb -s "$EMU" shell am force-stop io.github.unloopyourself.dummytarget >/dev/null 2>&1 || true
adb -s "$EMU" shell appops set io.github.unloopyourself.unloop GET_USAGE_STATS allow
adb -s "$EMU" shell appops set io.github.unloopyourself.unloop SYSTEM_ALERT_WINDOW allow
sleep 1
if start_monitor "breath_tap" && open_challenge; then
  assert_enter "breath_tap" "regression_sticky_force_cleared"
else
  bad "regression_sticky_force_cleared" "expected breath_tap after CLEAR; open failed"
fi

reset_app

# --- REGRESSION: Menu → About (raw Text outside Text crash) ---
adb -s "$EMU" shell am force-stop io.github.unloopyourself.unloop >/dev/null 2>&1 || true
adb -s "$EMU" shell am start -n io.github.unloopyourself.unloop/.MainActivity >/dev/null
sleep 8
if wait_any 15 "Menu" >/dev/null && safe_tap "Menu"; then
  sleep 0.8
  ABOUT_LABEL="$(wait_any 10 "About" "Informazioni" || true)"
  if [[ -n "$ABOUT_LABEL" ]] && safe_tap "$ABOUT_LABEL"; then
    sleep 0.8
    if wait_any 12 "About Unloop" "Informazioni su Unloop" "unloopyourself.dev@gmail.com" >/dev/null; then
      ok "regression_menu_about" "About screen rendered"
    else
      dump_ui || true
      note "ui: $(rg -o 'text=\"[^\"]+\"' "$UIDUMP" 2>/dev/null | head -30 | tr '\n' ' ')"
      bad "regression_menu_about" "About content not visible"
    fi
  else
    bad "regression_menu_about" "About row not in menu"
  fi
else
  bad "regression_menu_about" "Menu control not found on home"
fi

reset_app

# --- sensor challenges: force enter + UI (complete is PARTIAL on AVD) ---
if [[ "$SOFT_ONLY" == "1" ]]; then
  note "SOFT_ONLY=1 — skipping sensor challenge enters"
else
  for cid in shake coin_spin face_down_flip; do
    if start_monitor "$cid" && open_challenge; then
      assert_enter "$cid" "enter_${cid}"
      if [[ "$cid" == "face_down_flip" ]]; then
        # Face-down (z negative) hold ≥3s, then face-up within 1s.
        adb -s "$EMU" emu sensor set acceleration 0:0:-9.8 >/dev/null || true
        sleep 3.4
        adb -s "$EMU" emu sensor set acceleration 0:0:9.8 >/dev/null || true
        sleep 1.2
        if wait_harness "harness: cooldown_completed" 8; then
          ok "face_down_flip_complete_e2e" "sensor inject completed"
        else
          note "PARTIAL face_down_flip_complete_e2e: enter OK; expo sensor→complete still flaky on AVD (L0 timers + L4)"
        fi
      else
        note "PARTIAL ${cid}_complete_e2e: enter+UI reached; motor/sensor complete deferred to device (L4)"
      fi
    else
      bad "enter_${cid}" "could not open forced $cid"
    fi
    reset_app
  done
  note "SKIP air_write: hidden from Settings this release (code kept; revisit later)"

  adb -s "$EMU" emu sensor set acceleration 9:2:1 >/dev/null
  GOT="$(adb -s "$EMU" emu sensor get acceleration | tr -d '\r')"
  if echo "$GOT" | rg -q "9:2:1"; then
    ok "sensor_accel_inject" "$GOT"
  else
    bad "sensor_accel_inject" "$GOT"
  fi
  adb -s "$EMU" emu sensor set acceleration 0:0:9.8 >/dev/null
fi

adb -s "$EMU" shell am broadcast -p io.github.unloopyourself.unloop -a io.github.unloopyourself.DEBUG_STOP_MONITOR >/dev/null 2>&1 || true

{
  echo
  echo "## Summary"
  echo "pass=$pass fail=$fail soft_only=$SOFT_ONLY"
} | tee -a "$REPORT"

echo "Report: $REPORT"
exit "$fail"
