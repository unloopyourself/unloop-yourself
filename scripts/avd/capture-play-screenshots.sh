#!/usr/bin/env bash
# Capture English Play Store screenshots from a connected emulator.
# Usage: UNLOOP_EMU=emulator-5554 UNLOOP_SHOT_DIR=... ./scripts/avd/capture-play-screenshots.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

EMU="${UNLOOP_EMU:-$(adb devices | awk '/emulator-.*device$/{print $1; exit}')}"
PKG=io.github.unloopyourself.unloop
DUMMY=io.github.unloopyourself.dummytarget
OUT="${UNLOOP_SHOT_DIR:-$ROOT/apps/mobile/assets/play/screenshots/phone}"
THRESHOLD_MS="${THRESHOLD_MS:-3000}"
UIDUMP=/tmp/unloop-play-uidump.xml
mkdir -p "$OUT"

if [[ -z "${EMU}" ]]; then
  echo "FAIL: no emulator" >&2
  exit 1
fi

echo "EMU=$EMU OUT=$OUT"

# Italian markers that must never appear in a saved shot's UI dump
ITALIAN_RE='Pronto quando|In ascolto|Smetti di monitorare|Salta per ora|Respira con me|Scrivi per sbloccare|Scuoti per tornare|Faccia in giù|Impostazioni|Accesso utilizzo|Esci dal tunnel|Me l.ho chiesto|Piccolo check|Tocca all'

dump_ui() {
  local i
  for ((i=0; i<5; i++)); do
    if adb -s "$EMU" shell uiautomator dump /sdcard/uidump.xml >/dev/null 2>&1 \
      && adb -s "$EMU" pull /sdcard/uidump.xml "$UIDUMP" >/dev/null 2>&1 \
      && [[ -s "$UIDUMP" ]]; then
      return 0
    fi
    sleep 0.3
  done
  return 1
}

assert_english() {
  dump_ui || return 1
  if rg -q "$ITALIAN_RE" "$UIDUMP"; then
    echo "REJECT: Italian UI detected — not saving" >&2
    rg -o 'text="[^"]+"' "$UIDUMP" | head -30 >&2 || true
    return 1
  fi
  return 0
}

tap_label() {
  local label="$1"
  python3 - "$UIDUMP" "$label" <<'PY'
import re, sys, subprocess, os
xml=open(sys.argv[1]).read()
label=sys.argv[2]
emu=os.environ.get("EMU_SERIAL","emulator-5554")
esc=re.escape(label)
for pat in (
  rf'(?:text|content-desc)="{esc}"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
  rf'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*(?:text|content-desc)="{esc}"',
):
  m=re.search(pat, xml)
  if m:
    x1,y1,x2,y2=map(int,m.groups())
    x,y=(x1+x2)//2,(y1+y2)//2
    subprocess.check_call(["adb","-s",emu,"shell","input","tap",str(x),str(y)])
    print("tapped", label)
    sys.exit(0)
sys.exit(1)
PY
}

wait_text() {
  local needle="$1"
  local max="${2:-40}"
  local i
  for ((i=0; i<max; i++)); do
    dump_ui || true
    if rg -q "$needle" "$UIDUMP" 2>/dev/null; then
      echo "found '$needle' (${i}s)"
      return 0
    fi
    if rg -q "isn't responding|Close app" "$UIDUMP" 2>/dev/null; then
      EMU_SERIAL="$EMU" tap_label "Wait" 2>/dev/null || EMU_SERIAL="$EMU" tap_label "Close app" 2>/dev/null || true
    fi
    sleep 1
  done
  echo "TIMEOUT waiting for '$needle'" >&2
  rg -o 'text="[^"]+"' "$UIDUMP" 2>/dev/null | head -40 >&2 || true
  return 1
}

shot() {
  local name="$1"
  local require="${2:-}"
  local reuse_dump="${3:-0}"
  if [[ "$reuse_dump" != "1" ]]; then
    assert_english || return 1
  else
    if rg -q "$ITALIAN_RE" "$UIDUMP" 2>/dev/null; then
      echo "REJECT: Italian UI detected — not saving" >&2
      return 1
    fi
  fi
  if [[ -n "$require" ]] && ! rg -q "$require" "$UIDUMP"; then
    echo "REJECT: missing marker '$require' for $name" >&2
    rg -o 'text="[^"]+"' "$UIDUMP" | head -40 >&2 || true
    return 1
  fi
  # Capture immediately — challenge screens can vanish into grace within a second.
  adb -s "$EMU" exec-out screencap -p > "$OUT/${name}.png"
  echo "saved $name ($(wc -c < "$OUT/${name}.png") bytes)"
}

force_challenge() {
  local cid="$1"
  local name="$2"
  local marker="$3"
  echo "=== challenge $cid -> $name ==="
  adb -s "$EMU" logcat -c >/dev/null 2>&1 || true
  adb -s "$EMU" shell am force-stop "$PKG" || true
  adb -s "$EMU" shell am force-stop "$DUMMY" || true
  sleep 1
  adb -s "$EMU" shell am start -n "$PKG/.MainActivity"
  wait_text "Start watching|Stop watching|Watching" 45 || true
  adb -s "$EMU" shell am broadcast -p "$PKG" \
    -a io.github.unloopyourself.DEBUG_START_MONITOR \
    --es packages "$DUMMY" \
    --el thresholdMs "$THRESHOLD_MS" \
    --es forceChallenge "$cid"
  sleep 1
  adb -s "$EMU" shell am start -n "$DUMMY/.MainActivity"
  local i
  for ((i=0; i<30; i++)); do
    if adb -s "$EMU" logcat -d 2>/dev/null | rg -q "THRESHOLD reached|enter_challenge:${cid}|forceChallenge:${cid}|harness forceChallenge=${cid}"; then
      echo "threshold ${i}s"
      break
    fi
    sleep 1
  done
  sleep 2
  for ((i=0; i<25; i++)); do
    dump_ui || true
    if EMU_SERIAL="$EMU" tap_label "Open challenge" 2>/dev/null; then
      sleep 2
      break
    fi
    sleep 0.7
  done
  adb -s "$EMU" shell am start -n "$PKG/.MainActivity" >/dev/null 2>&1 || true
  sleep 2
  if ! wait_text "$marker" 15; then
    dump_ui || true
    EMU_SERIAL="$EMU" tap_label "Open challenge" 2>/dev/null || true
    sleep 1
    adb -s "$EMU" shell am start -n "$PKG/.MainActivity" >/dev/null 2>&1 || true
    wait_text "$marker" 20 || true
  fi
  # Reuse the dump from wait_text; don't dump again or soft-unlock may win the race.
  shot "$name" "$marker" 1 || echo "WARN: skipped $name" >&2
}

# --- Home idle ---
echo "=== home ==="
adb -s "$EMU" shell am force-stop "$PKG" || true
sleep 1
adb -s "$EMU" shell am start -n "$PKG/.MainActivity"
wait_text "Start watching" 45
shot "01-home" "Start watching" || echo "WARN: skipped 01-home" >&2

# --- Settings ---
echo "=== settings ==="
dump_ui || true
# hamburger / menu — try common labels then top-right tap fallback
if ! EMU_SERIAL="$EMU" tap_label "Settings" 2>/dev/null; then
  # menu button content-desc often empty; tap near top-right
  size=$(adb -s "$EMU" shell wm size | awk -F': ' '{print $2}' | tr -d '\r')
  w=${size%x*}; h=${size#*x}
  adb -s "$EMU" shell input tap $((w - 80)) 160
  sleep 1
  dump_ui || true
  EMU_SERIAL="$EMU" tap_label "Settings" 2>/dev/null || true
fi
sleep 1
wait_text "Settings|FEEDS|CHALLENGES|TIMINGS|Interrupt after" 20 || true
shot "08-settings" "Settings|FEEDS TO INTERRUPT|TIMINGS" || echo "WARN: skipped 08-settings" >&2

# Back to home
adb -s "$EMU" shell input keyevent KEYCODE_BACK
sleep 1

# --- Home monitoring ---
echo "=== home monitoring ==="
adb -s "$EMU" shell am force-stop "$PKG" || true
sleep 1
adb -s "$EMU" shell am start -n "$PKG/.MainActivity"
wait_text "Start watching" 45
dump_ui || true
EMU_SERIAL="$EMU" tap_label "Start watching" || true
sleep 3
wait_text "Stop watching|Watching" 25 || true
shot "02-home-monitoring" "Stop watching|Watching" || echo "WARN: skipped 02-home-monitoring" >&2

# Challenges
force_challenge breath_tap "03-challenge-breath" "Breathe with me"
force_challenge unlock_phrase "04-challenge-phrase" "Type to unlock"
force_challenge nearest_multiple "05-challenge-math" "Quick mind check"
force_challenge shake "06-challenge-shake" "Shake to come back"
force_challenge face_down_flip "07-challenge-face" "Face-down flip|Waiting for face-down"

echo "=== done ==="
ls -lh "$OUT"/*.png 2>/dev/null || true
