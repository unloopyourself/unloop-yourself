package expo.modules.unloopusage

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Debug-only harness for AVD / agent automation.
 *
 * adb shell am broadcast -p io.github.unloopyourself.unloop \
 *   -a io.github.unloopyourself.DEBUG_START_MONITOR \
 *   --es packages "io.github.unloopyourself.dummytarget" --el thresholdMs 15000 \
 *   --es forceChallenge "shake" \
 *   --es capabilities "accelerometer,gyroscope"
 *
 * capabilities: comma-separated Core capability ids; empty string forces low_end
 * (no sensors). Omit the extra to leave detection to the JS adapter.
 */
class DebugHarnessReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val action = intent?.action ?: return
    if (
      action != ACTION_START_MONITOR &&
      action != ACTION_STOP_MONITOR &&
      action != ACTION_CLEAR_HARNESS
    ) {
      return
    }
    Log.i(TAG, "debug harness action=$action")
    when (action) {
      ACTION_START_MONITOR -> {
        val packages =
          intent.getStringExtra(EXTRA_PACKAGES) ?: "io.github.unloopyourself.dummytarget"
        val thresholdMs = intent.getLongExtra(EXTRA_THRESHOLD_MS, 15_000L)
        val forceChallenge = intent.getStringExtra(EXTRA_FORCE_CHALLENGE).orEmpty()
        HarnessPrefs.setForceChallengeId(context, forceChallenge)
        if (forceChallenge.isNotEmpty()) {
          Log.i(TAG, "harness forceChallenge=$forceChallenge")
        }
        if (intent.hasExtra(EXTRA_CAPABILITIES)) {
          val caps = intent.getStringExtra(EXTRA_CAPABILITIES).orEmpty()
          HarnessPrefs.setCapabilitiesOverride(context, caps)
          Log.i(TAG, "harness capabilitiesOverride=$caps")
        } else {
          HarnessPrefs.clearCapabilitiesOverride(context)
        }
        UsageMonitorService.start(context, packages, thresholdMs)
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launch != null) {
          launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
          launch.putExtra("unloop_debug_monitoring", true)
          context.startActivity(launch)
        }
      }
      ACTION_STOP_MONITOR -> {
        HarnessPrefs.clear(context)
        UsageMonitorService.stop(context)
        InterruptOverlay.resolve(context)
      }
      ACTION_CLEAR_HARNESS -> {
        // Mirrors UnloopUsage.clearHarnessDebugState() / Start watching — drop sticky forceChallenge.
        HarnessPrefs.clear(context)
        Log.i(TAG, "harness: cleared prefs")
      }
    }
  }

  companion object {
    private const val TAG = "UnloopUsageMonitor"
    const val ACTION_START_MONITOR = "io.github.unloopyourself.DEBUG_START_MONITOR"
    const val ACTION_STOP_MONITOR = "io.github.unloopyourself.DEBUG_STOP_MONITOR"
    const val ACTION_CLEAR_HARNESS = "io.github.unloopyourself.DEBUG_CLEAR_HARNESS"
    const val EXTRA_PACKAGES = "packages"
    const val EXTRA_THRESHOLD_MS = "thresholdMs"
    const val EXTRA_FORCE_CHALLENGE = "forceChallenge"
    const val EXTRA_CAPABILITIES = "capabilities"
  }
}

/** SharedPreferences bridge for debug harness (read from JS). */
object HarnessPrefs {
  private const val NAME = "unloop_harness"
  private const val KEY_FORCE = "forceChallengeId"
  private const val KEY_CAPS = "capabilitiesOverride"
  private const val KEY_CAPS_SET = "capabilitiesOverrideSet"

  fun setForceChallengeId(context: Context, id: String) {
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_FORCE, id)
      .commit()
  }

  fun getForceChallengeId(context: Context): String =
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .getString(KEY_FORCE, "")
      .orEmpty()

  fun setCapabilitiesOverride(context: Context, csv: String) {
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_CAPS_SET, true)
      .putString(KEY_CAPS, csv)
      .commit()
  }

  fun clearCapabilitiesOverride(context: Context) {
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_CAPS_SET, false)
      .remove(KEY_CAPS)
      .commit()
  }

  /** null = no override (adapter should probe). Otherwise CSV (possibly empty). */
  fun getCapabilitiesOverrideOrNull(context: Context): String? {
    val prefs = context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
    if (!prefs.getBoolean(KEY_CAPS_SET, false)) {
      return null
    }
    return prefs.getString(KEY_CAPS, "").orEmpty()
  }

  fun clear(context: Context) {
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE).edit().clear().commit()
  }
}
