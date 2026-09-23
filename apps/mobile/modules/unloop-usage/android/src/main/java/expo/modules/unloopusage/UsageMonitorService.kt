package expo.modules.unloopusage

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat

/**
 * Keeps UsageStats polling alive while Unloop is not in the foreground.
 * On threshold, brings the app to the front (MVP interrupt — not a system overlay yet).
 */
class UsageMonitorService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var packageNameTarget: String = ""
  private var thresholdMs: Long = 60_000L
  private var baselineMs: Long = -1L
  private var dayStartMs: Long = 0L
  private var fired = false

  private val tick = object : Runnable {
    override fun run() {
      if (packageNameTarget.isEmpty()) {
        return
      }
      val endMs = System.currentTimeMillis()
      val usage = UnloopUsageModule.queryUsageMs(this@UsageMonitorService, packageNameTarget, dayStartMs, endMs)
      if (baselineMs < 0L) {
        baselineMs = usage
      }
      val delta = usage - baselineMs
      if (!fired && delta >= thresholdMs) {
        fired = true
        thresholdCallback?.invoke(packageNameTarget, delta)
        UnloopUsageModule.bringAppToForeground(this@UsageMonitorService)
      }
      handler.postDelayed(this, POLL_MS)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopSelfSafe()
        return START_NOT_STICKY
      }
      ACTION_START -> {
        packageNameTarget = intent.getStringExtra(EXTRA_PACKAGE) ?: ""
        thresholdMs = intent.getLongExtra(EXTRA_THRESHOLD_MS, 60_000L)
        val now = java.util.Calendar.getInstance()
        now.set(java.util.Calendar.HOUR_OF_DAY, 0)
        now.set(java.util.Calendar.MINUTE, 0)
        now.set(java.util.Calendar.SECOND, 0)
        now.set(java.util.Calendar.MILLISECOND, 0)
        dayStartMs = now.timeInMillis
        baselineMs = -1L
        fired = false
        startForeground(NOTIFICATION_ID, buildNotification())
        handler.removeCallbacks(tick)
        handler.post(tick)
      }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(tick)
    super.onDestroy()
  }

  private fun stopSelfSafe() {
    handler.removeCallbacks(tick)
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun buildNotification(): Notification {
    ensureChannel()
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pending = PendingIntent.getActivity(
      this,
      0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Unloop is monitoring")
      .setContentText("I’ll interrupt when you asked me to — tap to open.")
      .setSmallIcon(android.R.drawable.ic_popup_reminder)
      .setContentIntent(pending)
      .setOngoing(true)
      .build()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val manager = getSystemService(NotificationManager::class.java)
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Unloop monitoring",
      NotificationManager.IMPORTANCE_LOW,
    )
    manager.createNotificationChannel(channel)
  }

  companion object {
    const val ACTION_START = "dev.unloopyourself.usage.START"
    const val ACTION_STOP = "dev.unloopyourself.usage.STOP"
    const val EXTRA_PACKAGE = "package"
    const val EXTRA_THRESHOLD_MS = "thresholdMs"
    private const val CHANNEL_ID = "unloop_monitoring"
    private const val NOTIFICATION_ID = 42001
    private const val POLL_MS = 5_000L

    @Volatile
    var thresholdCallback: ((packageName: String, deltaU: Long) -> Unit)? = null

    fun start(context: Context, packageName: String, thresholdMs: Long) {
      val intent = Intent(context, UsageMonitorService::class.java).apply {
        action = ACTION_START
        putExtra(EXTRA_PACKAGE, packageName)
        putExtra(EXTRA_THRESHOLD_MS, thresholdMs)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      val intent = Intent(context, UsageMonitorService::class.java).apply {
        action = ACTION_STOP
      }
      context.startService(intent)
    }
  }
}
