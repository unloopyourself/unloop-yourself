package expo.modules.unloopusage

import android.content.Context

/**
 * Persists the user's monitoring intent so a BootReceiver (and sticky FGS
 * restarts) can resume watching without waiting for React Native.
 */
object MonitorPrefs {
  private const val NAME = "unloop_monitor"
  private const val KEY_DESIRED = "desired"
  private const val KEY_PACKAGES = "packagesCsv"
  private const val KEY_THRESHOLD_MS = "thresholdMs"

  fun setDesired(
    context: Context,
    desired: Boolean,
    packagesCsv: String = "",
    thresholdMs: Long = 60_000L,
  ) {
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_DESIRED, desired)
      .putString(KEY_PACKAGES, packagesCsv)
      .putLong(KEY_THRESHOLD_MS, thresholdMs)
      .apply()
  }

  fun setPackages(context: Context, packagesCsv: String) {
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_PACKAGES, packagesCsv)
      .apply()
  }

  fun setThresholdMs(context: Context, thresholdMs: Long) {
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .edit()
      .putLong(KEY_THRESHOLD_MS, thresholdMs)
      .apply()
  }

  fun clearDesired(context: Context) {
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_DESIRED, false)
      .apply()
  }

  fun isDesired(context: Context): Boolean =
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .getBoolean(KEY_DESIRED, false)

  fun packagesCsv(context: Context): String =
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .getString(KEY_PACKAGES, "")
      ?.trim()
      .orEmpty()

  fun thresholdMs(context: Context): Long =
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .getLong(KEY_THRESHOLD_MS, 60_000L)

  /**
   * Restart monitoring from prefs when the user left it on.
   * Returns true if a start was issued.
   */
  fun resumeIfDesired(context: Context): Boolean {
    if (!isDesired(context)) {
      return false
    }
    val packages = packagesCsv(context)
    if (packages.isEmpty()) {
      return false
    }
    UsageMonitorService.start(context, packages, thresholdMs(context))
    return true
  }
}
