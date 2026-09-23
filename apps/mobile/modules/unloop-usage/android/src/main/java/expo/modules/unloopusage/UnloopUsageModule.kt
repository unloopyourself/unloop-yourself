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

    Events("onThresholdReached")

    Function("hasUsagePermission") {
      hasUsagePermission()
    }

    Function("openUsageAccessSettings") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("getUsageMsForPackage") { packageName: String, startMs: Double, endMs: Double ->
      if (!hasUsagePermission()) {
        return@Function -1.0
      }
      queryUsageMs(packageName, startMs.toLong(), endMs.toLong()).toDouble()
    }

    Function("bringAppToForeground") {
      bringAppToForeground(context)
    }

    Function("startNativeMonitoring") { packageName: String, thresholdMs: Double ->
      UsageMonitorService.start(context, packageName, thresholdMs.toLong())
    }

    Function("stopNativeMonitoring") {
      UsageMonitorService.stop(context)
    }

    OnCreate {
      UsageMonitorService.thresholdCallback = { packageName, deltaU ->
        sendEvent(
          "onThresholdReached",
          mapOf(
            "appId" to packageName,
            "deltaU" to deltaU.toDouble(),
            "observedAtMs" to System.currentTimeMillis().toDouble(),
          ),
        )
        bringAppToForeground(context)
      }
    }

    OnDestroy {
      UsageMonitorService.thresholdCallback = null
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

  companion object {
    fun queryUsageMs(context: Context, packageName: String, startMs: Long, endMs: Long): Long {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val stats = usm.queryAndAggregateUsageStats(startMs, endMs)
      return stats[packageName]?.totalTimeInForeground ?: 0L
    }

    fun bringAppToForeground(context: Context) {
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
      launch.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED,
      )
      context.startActivity(launch)
    }
  }

  private fun queryUsageMs(packageName: String, startMs: Long, endMs: Long): Long {
    return Companion.queryUsageMs(context, packageName, startMs, endMs)
  }
}
