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
 * Do not auto-start MainActivity here: on Samsung that often demotes the
 * target app (YouTube) into Picture-in-Picture so the video keeps looping
 * in a bubble while Unloop is "resumed" underneath — the interrupt looks
 * like it failed. Cover the screen with the overlay; open the app only on
 * an explicit user tap.
 */
object InterruptOverlay {
  private const val TAG = "UnloopUsageMonitor"

  @Volatile
  private var attachedView: android.view.View? = null

  fun canDrawOverlays(context: Context): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      Settings.canDrawOverlays(context)
    } else {
      true
    }
  }

  fun isShowing(): Boolean = attachedView != null

  fun show(context: Context) {
    if (!canDrawOverlays(context)) {
      Log.w(TAG, "overlay permission missing — cannot cover other apps")
      return
    }

    val appContext = context.applicationContext
    val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
    mainHandler.post {
      try {
        if (attachedView != null) {
          Log.i(TAG, "interrupt overlay already showing")
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
          setBackgroundColor(Color.parseColor("#F21A3C34"))
          setPadding(dp(28), dp(48), dp(28), dp(48))
          gravity = Gravity.CENTER
          // Consume touches so YouTube underneath (or PiP) cannot be used.
          isClickable = true
          isFocusable = true
        }

        val brand = TextView(appContext).apply {
          text = "Unloop"
          setTextColor(Color.WHITE)
          setTextSize(TypedValue.COMPLEX_UNIT_SP, 36f)
          gravity = Gravity.CENTER
        }

        val copy = TextView(appContext).apply {
          text = "I’m interrupting you because you asked me to.\nOpen the challenge to continue."
          setTextColor(Color.WHITE)
          setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
          gravity = Gravity.CENTER
          setPadding(0, dp(16), 0, dp(28))
        }

        val open = Button(appContext).apply {
          text = "Open challenge"
          setOnClickListener {
            launchApp(appContext)
            dismissLocked(appContext)
          }
        }

        root.addView(brand)
        root.addView(copy)
        root.addView(open)

        wm.addView(root, params)
        attachedView = root
        Log.i(TAG, "interrupt overlay shown (no auto startActivity)")
      } catch (t: Throwable) {
        Log.e(TAG, "failed to show interrupt overlay", t)
      }
    }
  }

  fun dismiss(context: Context) {
    val appContext = context.applicationContext
    android.os.Handler(android.os.Looper.getMainLooper()).post {
      dismissLocked(appContext)
    }
  }

  private fun dismissLocked(context: Context) {
    val view = attachedView ?: return
    try {
      val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
      wm.removeView(view)
      Log.i(TAG, "interrupt overlay dismissed")
    } catch (t: Throwable) {
      Log.w(TAG, "overlay dismiss failed", t)
    } finally {
      attachedView = null
    }
  }

  private fun launchApp(context: Context) {
    try {
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
      launch.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_CLEAR_TOP,
      )
      context.startActivity(launch)
    } catch (t: Throwable) {
      Log.e(TAG, "launchApp from overlay failed", t)
    }
  }
}
