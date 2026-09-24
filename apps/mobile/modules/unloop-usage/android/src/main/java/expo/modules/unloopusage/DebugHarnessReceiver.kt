package expo.modules.unloopusage

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Debug-only harness for AVD / agent automation.
 * Starts the usage monitor FGS without going through the React UI.
 *
 * adb shell am broadcast -a dev.unloopyourself.DEBUG_START_MONITOR \
 *   --es packages "dev.unloopyourself.dummytarget" --el thresholdMs 15000
 */
class DebugHarnessReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != ACTION_START_MONITOR && intent?.action != ACTION_STOP_MONITOR) {
      return
    }
    Log.i(TAG, "debug harness action=${intent.action}")
    when (intent.action) {
      ACTION_START_MONITOR -> {
        val packages =
          intent.getStringExtra(EXTRA_PACKAGES) ?: "dev.unloopyourself.dummytarget"
        val thresholdMs = intent.getLongExtra(EXTRA_THRESHOLD_MS, 15_000L)
        UsageMonitorService.start(context, packages, thresholdMs)
        // Bring Unloop up so JS can receive threshold events / show challenge.
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launch != null) {
          launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
          launch.putExtra("unloop_debug_monitoring", true)
          context.startActivity(launch)
        }
      }
      ACTION_STOP_MONITOR -> {
        UsageMonitorService.stop(context)
        InterruptOverlay.resolve(context)
      }
    }
  }

  companion object {
    private const val TAG = "UnloopUsageMonitor"
    const val ACTION_START_MONITOR = "dev.unloopyourself.DEBUG_START_MONITOR"
    const val ACTION_STOP_MONITOR = "dev.unloopyourself.DEBUG_STOP_MONITOR"
    const val EXTRA_PACKAGES = "packages"
    const val EXTRA_THRESHOLD_MS = "thresholdMs"
  }
}
