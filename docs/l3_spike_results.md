# L3 AVD spike — empirical results (2026-09-24)

AVD: `unloop_api34` — `system-images;android-34;google_apis_playstore;arm64-v8a`  
Host: macOS arm64 · Emulator started **by human** (agent headless starts were unstable).

## Matrix

| Capability | Result | Evidence |
|------------|--------|----------|
| Install APK (Unloop + Dummy) | PASS | `adb install -r` |
| Launch dummy foreground | PASS | `topResumedActivity=…dummytarget` |
| Usage Access via appops | PASS | `GET_USAGE_STATS: allow` |
| Overlay via appops | PASS | `SYSTEM_ALERT_WINDOW: allow` |
| UsageStats sees dummy | PASS | active package + growing `totalTimeUsed` |
| Debug start monitor | PASS | broadcast `-p dev.unloopyourself.app` + `forceChallenge` |
| Threshold → overlay | PASS | logcat `THRESHOLD reached` + overlay shown |
| Open challenge | PASS | uiautomator → `MainActivity` + `harness: enter_challenge:*` |
| Soft-fail Skip E2E | PASS | `harness: cooldown_soft_fail` after Skip tap |
| Challenge complete E2E (breath_tap) | PASS | 3× tap → `harness: cooldown_completed` |
| `adb emu sensor` accel | PASS | set/get `9:2:1` |
| Shake → complete via sensor | PARTIAL | Shake UI + inject OK; expo-sensors on AVD does not accumulate to complete — L0 Vitest owns semantics; L4 human motor |
| Activity force-stop relaunch | PASS | pid returns |
| FGS after force-stop | N/A | OS kills FGS on force-stop |
| Debug APK without Metro | PASS | `debuggableVariants = []` embeds JS bundle |

## Environment notes

* Plain `google_apis` image lacked `userdata.img` → use **playstore** image.  
* Prefer human-started windowed AVD; agent attaches via `adb -s emulator-5554`.  
* Emulator chrome Home button flaky → `adb shell input keyevent 3` or Esc.  
* Disconnect extra devices (e.g. Samsung) during L3 — multi-device breaks unqualified `adb`.  
* Between harness scenarios: `pm clear` + re-grant appops to avoid cooldown bleed.  
* uiautomator on AVD is flaky under load (`null root node` / idle errors); harness retries and also accepts `harness: enter_challenge` log lines.

## Artifacts

* Dummy target: `apps/dummy-target`  
* Harness: `scripts/avd/run-l3-scenarios.sh`  
* Debug receiver: `DebugHarnessReceiver` (`forceChallenge` extra)  
* Core loop: `SessionEngine` + `REGRESSION` Vitest suite  
* Reports: `factory/l3-reports/`
