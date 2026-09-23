package expo.modules.unloopusage

import android.app.AppOpsManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
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
        interruptFromBackground(context)
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
    private const val TAG = "UnloopUsageMonitor"
    private const val INTERRUPT_CHANNEL = "unloop_interrupt"
    private const val INTERRUPT_NOTIFICATION_ID = 42002

    fun queryUsageMs(context: Context, packageName: String, startMs: Long, endMs: Long): Long {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val stats = usm.queryAndAggregateUsageStats(startMs, endMs)
      return stats[packageName]?.totalTimeInForeground ?: 0L
    }

    fun bringAppToForeground(context: Context) {
      interruptFromBackground(context)
    }

    /**
     * Background activity starts are restricted on modern Android/Samsung.
     * Use a high-priority full-screen intent notification (alarm-style) plus startActivity.
     */
    fun interruptFromBackground(context: Context) {
      Log.i(TAG, "interruptFromBackground")
      ensureInterruptChannel(context)

      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
      launch.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
      )

      val fullScreen = PendingIntent.getActivity(
        context,
        1,
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

      val notification = NotificationCompat.Builder(context, INTERRUPT_CHANNEL)
        .setContentTitle("Unloop")
        .setContentText("I’m interrupting you because you asked me to.")
        .setSmallIcon(android.R.drawable.ic_popup_reminder)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setCategory(NotificationCompat.CATEGORY_ALARM)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setAutoCancel(true)
        .setContentIntent(fullScreen)
        .setFullScreenIntent(fullScreen, true)
        .build()

      val manager = context.getSystemService(NotificationManager::class.java)
      manager.notify(INTERRUPT_NOTIFICATION_ID, notification)

      try {
        context.startActivity(launch)
      } catch (t: Throwable) {
        Log.e(TAG, "startActivity blocked; relying on full-screen intent", t)
      }
    }

    private fun ensureInterruptChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return
      }
      val manager = context.getSystemService(NotificationManager::class.java)
      val channel = NotificationChannel(
        INTERRUPT_CHANNEL,
        "Unloop interrupt",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Breaks through when a challenge should appear"
        setBypassDnd(true)
        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
      }
      manager.createNotificationChannel(channel)
    }
  }

  private fun queryUsageMs(packageName: String, startMs: Long, endMs: Long): Long {
    return Companion.queryUsageMs(context, packageName, startMs, endMs)
  }
}
