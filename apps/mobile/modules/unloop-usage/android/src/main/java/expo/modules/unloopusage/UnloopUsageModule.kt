package expo.modules.unloopusage

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class UnloopUsageModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("UnloopUsage")

    Function("hasUsagePermission") {
      hasUsagePermission()
    }

    Function("openUsageAccessSettings") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    /**
     * Returns aggregate foreground time in milliseconds for [packageName]
     * between [startMs] and [endMs] (epoch millis), or -1 if permission missing.
     */
    Function("getUsageMsForPackage") { packageName: String, startMs: Double, endMs: Double ->
      if (!hasUsagePermission()) {
        return@Function -1.0
      }
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val stats = usm.queryAndAggregateUsageStats(startMs.toLong(), endMs.toLong())
      val entry = stats[packageName]
      (entry?.totalTimeInForeground ?: 0L).toDouble()
    }
  }

  private fun hasUsagePermission(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      context.packageName,
    )
    return mode == AppOpsManager.MODE_ALLOWED
  }
}
