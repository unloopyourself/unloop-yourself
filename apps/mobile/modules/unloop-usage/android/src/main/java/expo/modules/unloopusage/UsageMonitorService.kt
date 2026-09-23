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
 * Accumulates wall-clock time while the target package is the most recently used app
 * (UsageStats lastTimeUsed), which updates more reliably than aggregate foreground totals.
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
      try {
        if (packageNameTarget.isEmpty()) {
          return
        }
        refreshForegroundState()
        val matching = lastKnownFgPackage == packageNameTarget
        val nowElapsed = SystemClock.elapsedRealtime()
        if (lastTickElapsedRealtime > 0L && matching && !fired) {
          accumulatedMs += (nowElapsed - lastTickElapsedRealtime)
        }
        lastTickElapsedRealtime = nowElapsed

        val msg =
          "fg=$lastKnownFgPackage match=$matching acc=${accumulatedMs / 1000}s / ${thresholdMs / 1000}s"
        Log.i(TAG, msg)
        updateNotification(msg)

        if (!fired && accumulatedMs >= thresholdMs) {
          fired = true
          Log.i(TAG, "THRESHOLD reached — interrupting from background")
          thresholdCallback?.invoke(packageNameTarget, accumulatedMs)
          UnloopUsageModule.interruptFromBackground(this@UsageMonitorService)
        }
      } catch (t: Throwable) {
        Log.e(TAG, "tick failed", t)
      } finally {
        handler.postDelayed(this, POLL_MS)
      }
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
        Log.i(TAG, "START monitoring $packageNameTarget thr=${thresholdMs}ms")
        startForeground(NOTIFICATION_ID, buildNotification("Starting…"))
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
    Log.i(TAG, "service destroyed")
    super.onDestroy()
  }

  private fun refreshForegroundState() {
    val usm = getSystemService(USAGE_STATS_SERVICE) as UsageStatsManager
    val end = System.currentTimeMillis()
    val begin = end - LOOKBACK_MS
    val self = packageName

    // Primary: most recently used package, excluding Unloop itself (FGS/notifications
    // can refresh our lastTimeUsed and falsely look like we are in the foreground).
    val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_BEST, begin, end)
    val top = stats
      ?.filter { it.packageName != self }
      ?.maxByOrNull { it.lastTimeUsed }
    if (top != null && top.lastTimeUsed >= begin) {
      lastKnownFgPackage = top.packageName
      return
    }

    // Fallback: walk UsageEvents; last ACTIVITY_RESUMED wins (ignore our package).
    val events = usm.queryEvents(begin, end)
    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      if (event.packageName == self) {
        continue
      }
      if (
        event.eventType == UsageEvents.Event.ACTIVITY_RESUMED ||
        event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
      ) {
        lastKnownFgPackage = event.packageName
      }
    }
  }

  private fun stopSelfSafe() {
    handler.removeCallbacks(tick)
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun updateNotification(content: String) {
    val manager = getSystemService(NotificationManager::class.java)
    manager.notify(NOTIFICATION_ID, buildNotification(content))
  }

  private fun buildNotification(content: String): Notification {
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
      .setContentText(content)
      .setStyle(NotificationCompat.BigTextStyle().bigText(content))
      .setSmallIcon(android.R.drawable.ic_popup_reminder)
      .setContentIntent(pending)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
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
    private const val LOOKBACK_MS = 60_000L

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
