package expo.modules.unloopusage

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Polls UsageEvents (not delayed aggregate totals) and accumulates wall-clock time
 * while the target package is in the foreground.
 */
class UsageMonitorService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var packageNameTarget: String = ""
  private var thresholdMs: Long = 60_000L
  private var accumulatedMs: Long = 0L
  private var lastTickElapsedRealtime: Long = 0L
  private var lastKnownFgPackage: String? = null
  private var fired = false

  private val tick = object : Runnable {
    override fun run() {
      if (packageNameTarget.isEmpty()) {
        return
      }
      refreshForegroundState()
      val targetInForeground = lastKnownFgPackage == packageNameTarget
      val nowElapsed = SystemClock.elapsedRealtime()
      if (lastTickElapsedRealtime > 0L && targetInForeground && !fired) {
        accumulatedMs += (nowElapsed - lastTickElapsedRealtime)
      }
      lastTickElapsedRealtime = nowElapsed

      Log.d(
        TAG,
        "tick target=$packageNameTarget fgPkg=$lastKnownFgPackage matching=$targetInForeground acc=${accumulatedMs}ms thr=${thresholdMs}ms",
      )

      if (!fired && accumulatedMs >= thresholdMs) {
        fired = true
        thresholdCallback?.invoke(packageNameTarget, accumulatedMs)
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
        accumulatedMs = 0L
        lastTickElapsedRealtime = 0L
        lastKnownFgPackage = null
        fired = false
        startForeground(NOTIFICATION_ID, buildNotification())
        handler.removeCallbacks(tick)
        refreshForegroundState()
        lastTickElapsedRealtime = SystemClock.elapsedRealtime()
        handler.post(tick)
      }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(tick)
    super.onDestroy()
  }

  private fun refreshForegroundState() {
    val usm = getSystemService(USAGE_STATS_SERVICE) as UsageStatsManager
    val end = System.currentTimeMillis()
    val begin = end - LOOKBACK_MS
    val events = usm.queryEvents(begin, end)
    val event = UsageEvents.Event()
    var sawEvent = false
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      sawEvent = true
      when (event.eventType) {
        UsageEvents.Event.ACTIVITY_RESUMED,
        UsageEvents.Event.MOVE_TO_FOREGROUND,
        -> {
          lastKnownFgPackage = event.packageName
        }
        UsageEvents.Event.ACTIVITY_PAUSED,
        UsageEvents.Event.MOVE_TO_BACKGROUND,
        -> {
          if (event.packageName == lastKnownFgPackage) {
            lastKnownFgPackage = null
          }
        }
      }
    }
    if (!sawEvent) {
      Log.d(TAG, "no usage events in lookback; keeping fg=$lastKnownFgPackage")
    }
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
    private const val TAG = "UnloopUsageMonitor"
    const val ACTION_START = "dev.unloopyourself.usage.START"
    const val ACTION_STOP = "dev.unloopyourself.usage.STOP"
    const val EXTRA_PACKAGE = "package"
    const val EXTRA_THRESHOLD_MS = "thresholdMs"
    private const val CHANNEL_ID = "unloop_monitoring"
    private const val NOTIFICATION_ID = 42001
    private const val POLL_MS = 2_000L
    private const val LOOKBACK_MS = 30_000L

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
