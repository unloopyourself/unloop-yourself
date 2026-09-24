package expo.modules.unloopusage

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class UnloopUsageModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("UnloopUsage")

    Events("onThresholdReached", "onOpenChallenge")

    Function("hasUsagePermission") {
      hasUsagePermission()
    }

    Function("openUsageAccessSettings") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("hasOverlayPermission") {
      InterruptOverlay.canDrawOverlays(context)
    }

    Function("openOverlaySettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${context.packageName}"),
        )
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
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

    Function("dismissInterruptOverlay") {
      InterruptOverlay.resolve(context)
    }

    Function("setCooldownUntilMs") { epochMs: Double ->
      UsageMonitorService.armCooldownUntil(epochMs.toLong())
    }

    Function("clearCooldown") {
      UsageMonitorService.armCooldownUntil(0L)
    }

    Function("startNativeMonitoring") { packagesCsv: String, thresholdMs: Double ->
      UsageMonitorService.start(context, packagesCsv, thresholdMs.toLong())
    }

    Function("updateMonitoredPackages") { packagesCsv: String ->
      UsageMonitorService.updatePackages(context, packagesCsv)
    }

    Function("stopNativeMonitoring") {
      UsageMonitorService.stop(context)
    }

    Function("getMonitorSnapshot") {
      UsageMonitorService.monitorSnapshot()
    }

    Function("getHarnessForceChallengeId") {
      HarnessPrefs.getForceChallengeId(context)
    }

    Function("logHarness") { message: String ->
      Log.i(TAG, "harness: $message")
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
      InterruptOverlay.openChallengeCallback = {
        Log.i(TAG, "open challenge → notifying JS")
        sendEvent("onOpenChallenge", emptyMap<String, Any>())
      }
    }

    OnDestroy {
      UsageMonitorService.thresholdCallback = null
      InterruptOverlay.openChallengeCallback = null
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
    private const val TAG = "UnloopUsageMonitor"

    fun queryUsageMs(context: Context, packageName: String, startMs: Long, endMs: Long): Long {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val stats = usm.queryAndAggregateUsageStats(startMs, endMs)
      return stats[packageName]?.totalTimeInForeground ?: 0L
    }

    fun bringAppToForeground(context: Context) {
      Log.i(TAG, "bringAppToForeground → overlay only (avoid PiP)")
      InterruptOverlay.show(context)
    }
  }

  private fun queryUsageMs(packageName: String, startMs: Long, endMs: Long): Long {
    return Companion.queryUsageMs(context, packageName, startMs, endMs)
  }
}
