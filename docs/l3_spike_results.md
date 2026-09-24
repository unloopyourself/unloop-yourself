# L3 AVD spike — empirical results (2026-09-24)

AVD: `unloop_api34` — `system-images;android-34;google_apis_playstore;arm64-v8a`  
Host: macOS arm64 · Emulator started **by human** (agent headless starts were unstable / process died).

## Matrix

| Capability | Result | Evidence |
|------------|--------|----------|
| Install APK (Unloop + Dummy) | PASS | `adb install -r` |
| Launch dummy foreground | PASS | `topResumedActivity=…dummytarget` |
| Usage Access via appops | PASS | `GET_USAGE_STATS: allow` |
| Overlay via appops | PASS | `SYSTEM_ALERT_WINDOW: allow` |
| UsageStats sees dummy | PASS | `Currently Active:dev.unloopyourself.dummytarget`, `totalTimeUsed` growing |
| Debug start monitor | PASS | logcat `START monitoring [dev.unloopyourself.dummytarget] thr=10000ms` (broadcast **must** use `-p dev.unloopyourself.app`) |
| Threshold → overlay | PASS | `THRESHOLD reached … showing overlay` + `interrupt overlay shown` |
| Open challenge | PASS | uiautomator tap → `MainActivity` resumed |
| `adb emu sensor` accel | PASS | set `8:1:2` / `9:2:1` read back OK |
| Shake → challenge complete E2E | PARTIAL | Injection works; full complete needs Metro+JS in CHALLENGE — keep asserting in L0; improve L3 UI path |
| Soft-fail Skip E2E | PARTIAL | Same JS dependency; L0 owns semantics |
| Activity force-stop relaunch | PASS | pid returns |
| FGS after force-stop | N/A | OS kills FGS on force-stop |

## Environment notes

* Plain `google_apis` image lacked `userdata.img` → AVD create failed; **playstore** image works.  
* Agent-launched headless emulator often exited after boot; prefer human-started windowed AVD, then agent attaches via `adb`.  
* Emulator chrome Home button flaky → `adb shell input keyevent 3`.  
* Metro required for JS challenge UI; native overlay path does **not** need Metro.

## Artifacts

* Dummy target: `apps/dummy-target`  
* Harness: `scripts/avd/run-l3-scenarios.sh`  
* Debug receiver: `DebugHarnessReceiver`  
* Core loop: `SessionEngine` + `REGRESSION` Vitest suite  
