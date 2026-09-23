package expo.modules.unloopusage

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Full-screen TYPE_APPLICATION_OVERLAY interrupt.
 *
 * Opening the challenge only hides the shield temporarily. Until the challenge
 * is resolved, [challengeOutstanding] stays true so the monitor can re-cover
 * the feed if the user presses Home and returns to YouTube mid-challenge.
 */
object InterruptOverlay {
  private const val TAG = "UnloopUsageMonitor"

  @Volatile
  private var attachedView: android.view.View? = null

  /** True from first interrupt until shake completed / monitoring stopped. */
  @Volatile
  var challengeOutstanding: Boolean = false
    private set

  /** JS resumes here when the user taps Open challenge (Activity may have been killed). */
  @Volatile
  var openChallengeCallback: (() -> Unit)? = null

  /** After "Open challenge", skip re-show briefly so the Activity can come up. */
  @Volatile
  private var suppressReshowUntilElapsed: Long = 0L

  fun canDrawOverlays(context: Context): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      Settings.canDrawOverlays(context)
    } else {
      true
    }
  }

  fun isShowing(): Boolean = attachedView != null

  fun isReshowSuppressed(): Boolean =
    android.os.SystemClock.elapsedRealtime() < suppressReshowUntilElapsed

  fun show(context: Context) {
    if (!canDrawOverlays(context)) {
      Log.w(TAG, "overlay permission missing — cannot cover other apps")
      return
    }

    challengeOutstanding = true
    val appContext = context.applicationContext
    val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
    mainHandler.post {
      try {
        if (attachedView != null) {
          Log.i(TAG, "interrupt overlay already showing")
          PlaybackPauser.pause(appContext)
          return@post
        }
        val wm = appContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
          @Suppress("DEPRECATION")
          WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
          WindowManager.LayoutParams.MATCH_PARENT,
          WindowManager.LayoutParams.MATCH_PARENT,
          type,
          WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
          PixelFormat.TRANSLUCENT,
        ).apply {
          gravity = Gravity.CENTER
          title = "Unloop interrupt"
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            layoutInDisplayCutoutMode =
              WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
          }
        }

        val density = appContext.resources.displayMetrics.density
        fun dp(v: Int) = (v * density).toInt()

        val root = LinearLayout(appContext).apply {
          orientation = LinearLayout.VERTICAL
          setBackgroundColor(Color.parseColor("#F20A2540"))
          setPadding(dp(28), dp(48), dp(28), dp(48))
          gravity = Gravity.CENTER
          isClickable = true
          isFocusable = true
        }

        val brand = TextView(appContext).apply {
          text = "Unloop"
          setTextColor(Color.parseColor("#FF8A5B"))
          setTextSize(TypedValue.COMPLEX_UNIT_SP, 40f)
          gravity = Gravity.CENTER
        }

        val copy = TextView(appContext).apply {
          text = "I’m interrupting you because you asked me to.\nFinish the shake challenge to continue."
          setTextColor(Color.parseColor("#F2F5F8"))
          setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
          gravity = Gravity.CENTER
          setPadding(0, dp(16), 0, dp(28))
        }

        val open = Button(appContext).apply {
          text = "Open challenge"
          setBackgroundColor(Color.parseColor("#E85D04"))
          setTextColor(Color.WHITE)
          setOnClickListener {
            if (UsageMonitorService.inCooldown()) {
              Log.i(TAG, "open tapped during cooldown — dismissing shield only")
              InterruptOverlay.resolve(appContext)
              launchApp(appContext)
              return@setOnClickListener
            }
            // Hide shield only while Unloop is in front — outstanding stays true.
            suppressReshowUntilElapsed = android.os.SystemClock.elapsedRealtime() + 4_000L
            openChallengeCallback?.invoke()
            launchApp(appContext)
            dismissLocked(appContext, clearOutstanding = false)
          }
        }

        root.addView(brand)
        root.addView(copy)
        root.addView(open)

        wm.addView(root, params)
        attachedView = root
        PlaybackPauser.pause(appContext)
        Log.i(TAG, "interrupt overlay shown (outstanding=$challengeOutstanding)")
      } catch (t: Throwable) {
        Log.e(TAG, "failed to show interrupt overlay", t)
      }
    }
  }

  /** Call when the challenge is completed or monitoring stops. */
  fun resolve(context: Context) {
    challengeOutstanding = false
    val appContext = context.applicationContext
    android.os.Handler(android.os.Looper.getMainLooper()).post {
      dismissLocked(appContext, clearOutstanding = false)
    }
  }

  fun dismiss(context: Context) {
    resolve(context)
  }

  private fun dismissLocked(context: Context, clearOutstanding: Boolean) {
    if (clearOutstanding) {
      challengeOutstanding = false
    }
    val view = attachedView ?: run {
      if (!challengeOutstanding) {
        PlaybackPauser.release(context)
      }
      return
    }
    try {
      val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
      wm.removeView(view)
      Log.i(TAG, "interrupt overlay dismissed (outstanding=$challengeOutstanding)")
    } catch (t: Throwable) {
      Log.w(TAG, "overlay dismiss failed", t)
    } finally {
      attachedView = null
      PlaybackPauser.release(context)
    }
  }

  private fun launchApp(context: Context) {
    try {
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
      // Avoid CLEAR_TOP — it remounts React and drops the in-memory FSM.
      launch.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
          Intent.FLAG_ACTIVITY_SINGLE_TOP,
      )
      context.startActivity(launch)
    } catch (t: Throwable) {
      Log.e(TAG, "launchApp from overlay failed", t)
    }
  }
}
