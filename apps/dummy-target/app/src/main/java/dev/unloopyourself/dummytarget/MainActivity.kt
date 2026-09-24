package dev.unloopyourself.dummytarget

import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.TypedValue
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * Controlled “doomscroll stand-in” for AVD scenario tests.
 * Stays in the foreground and shows elapsed time so UsageStats accumulates.
 */
class MainActivity : AppCompatActivity() {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var clock: TextView
  private val startedAt = SystemClock.elapsedRealtime()

  private val tick = object : Runnable {
    override fun run() {
      val sec = (SystemClock.elapsedRealtime() - startedAt) / 1000L
      clock.text = "Foreground ${sec}s"
      handler.postDelayed(this, 500L)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val density = resources.displayMetrics.density
    fun dp(v: Int) = (v * density).toInt()

    clock = TextView(this).apply {
      setTextColor(Color.parseColor("#0A2540"))
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
      gravity = Gravity.CENTER
    }

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.parseColor("#E8F0F7"))
      gravity = Gravity.CENTER
      setPadding(dp(24), dp(24), dp(24), dp(24))
      addView(
        TextView(this@MainActivity).apply {
          text = "Unloop Dummy Feed"
          setTextColor(Color.parseColor("#E85D04"))
          setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
          gravity = Gravity.CENTER
        },
      )
      addView(clock)
      addView(
        TextView(this@MainActivity).apply {
          text = "Stay open so UsageStats can accumulate."
          setTextColor(Color.parseColor("#4A6278"))
          setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
          gravity = Gravity.CENTER
          setPadding(0, dp(16), 0, 0)
        },
      )
    }
    setContentView(root)
  }

  override fun onResume() {
    super.onResume()
    handler.post(tick)
  }

  override fun onPause() {
    handler.removeCallbacks(tick)
    super.onPause()
  }
}
