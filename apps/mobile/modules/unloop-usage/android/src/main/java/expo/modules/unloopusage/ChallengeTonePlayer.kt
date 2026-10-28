package expo.modules.unloopusage

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log

/**
 * Thin challenge tone — Android [ToneGenerator] only (no expo-av).
 * Uses STREAM_ALARM so a muted media slider does not silence the interrupt.
 * Pulses for the whole window (some OEMs truncate a single startTone).
 */
object ChallengeTonePlayer {
  private const val TAG = "UnloopUsageMonitor"
  private const val PULSE_MS = 900
  private const val PULSE_GAP_MS = 1_100L

  private val mainHandler = Handler(Looper.getMainLooper())
  private var toneGenerator: ToneGenerator? = null
  private var pulseRunnable: Runnable? = null
  private var focusRequest: AudioFocusRequest? = null
  private var heldLegacyFocus = false

  /**
   * @return true if a tone generator started (does not guarantee the user hears
   * it if the alarm stream volume is 0).
   */
  fun play(context: Context, durationMs: Long, volumePercent: Int = 100): Boolean {
    stop(context)
    val totalMs = durationMs.coerceIn(100L, 15_000L)
    val volume = volumePercent.coerceIn(0, 100)
    val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val alarmVol = audio.getStreamVolume(AudioManager.STREAM_ALARM)
    val alarmMax = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM)
    val musicVol = audio.getStreamVolume(AudioManager.STREAM_MUSIC)
    Log.i(
      TAG,
      "challenge tone request ${totalMs}ms vol=$volume alarm=$alarmVol/$alarmMax music=$musicVol",
    )
    return try {
      requestFocus(audio)
      // STREAM_ALARM: audible even when media volume is low (common on Samsung).
      val tg = ToneGenerator(AudioManager.STREAM_ALARM, volume)
      toneGenerator = tg
      val deadline = android.os.SystemClock.elapsedRealtime() + totalMs
      val pulse = object : Runnable {
        override fun run() {
          val gen = toneGenerator ?: return
          if (android.os.SystemClock.elapsedRealtime() >= deadline) {
            stop(context)
            return
          }
          try {
            gen.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, PULSE_MS)
          } catch (t: Throwable) {
            Log.w(TAG, "challenge tone pulse failed", t)
          }
          pulseRunnable = this
          mainHandler.postDelayed(this, PULSE_GAP_MS)
        }
      }
      pulseRunnable = pulse
      pulse.run()
      Log.i(TAG, "challenge tone started ${totalMs}ms (pulsed) alarmVol=$alarmVol/$alarmMax")
      true
    } catch (t: Throwable) {
      Log.w(TAG, "challenge tone failed", t)
      releaseQuietly()
      abandonFocus(audio)
      false
    }
  }

  fun stop(context: Context? = null) {
    pulseRunnable?.let { mainHandler.removeCallbacks(it) }
    pulseRunnable = null
    releaseQuietly()
    if (context != null) {
      val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      abandonFocus(audio)
    }
  }

  private fun requestFocus(audio: AudioManager) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
          .setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_ALARM)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build(),
          )
          .setOnAudioFocusChangeListener { /* hold */ }
          .build()
        focusRequest = req
        audio.requestAudioFocus(req)
      } else {
        @Suppress("DEPRECATION")
        audio.requestAudioFocus(
          null,
          AudioManager.STREAM_ALARM,
          AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK,
        )
        heldLegacyFocus = true
      }
    } catch (t: Throwable) {
      Log.w(TAG, "challenge tone focus failed", t)
    }
  }

  private fun abandonFocus(audio: AudioManager) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        focusRequest?.let { audio.abandonAudioFocusRequest(it) }
        focusRequest = null
      } else if (heldLegacyFocus) {
        @Suppress("DEPRECATION")
        audio.abandonAudioFocus(null)
        heldLegacyFocus = false
      }
    } catch (_: Throwable) {
      /* ignore */
    }
  }

  private fun releaseQuietly() {
    val tg = toneGenerator ?: return
    toneGenerator = null
    try {
      tg.stopTone()
    } catch (_: Throwable) {
      /* ignore */
    }
    try {
      tg.release()
    } catch (_: Throwable) {
      /* ignore */
    }
  }
}
