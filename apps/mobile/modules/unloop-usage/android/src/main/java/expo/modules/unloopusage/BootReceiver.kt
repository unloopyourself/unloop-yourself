package expo.modules.unloopusage

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * After reboot (or app update), resume the usage monitor if the user left
 * monitoring on. Does not launch the UI — the FGS + overlay path is enough
 * until the user opens a challenge.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val action = intent?.action ?: return
    if (
      action != Intent.ACTION_BOOT_COMPLETED &&
      action != Intent.ACTION_MY_PACKAGE_REPLACED
    ) {
      return
    }
    val started = MonitorPrefs.resumeIfDesired(context.applicationContext)
    Log.i(TAG, "boot/replace action=$action resumed=$started")
  }

  companion object {
    private const val TAG = "UnloopUsageMonitor"
  }
}
