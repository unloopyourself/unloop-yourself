package expo.modules.unloopusage

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.util.Log
import android.view.KeyEvent

/**
 * Best-effort pause of whatever is currently playing (e.g. YouTube Shorts)
 * when Unloop interrupts. Apps cannot force-stop other packages; audio focus
 * + a media pause key is the supported path.
 */
object PlaybackPauser {
  private const val TAG = "UnloopUsageMonitor"

  @Volatile
  private var focusRequest: AudioFocusRequest? = null

  @Volatile
  private var heldLegacy = false

  private val focusListener = AudioManager.OnAudioFocusChangeListener { /* hold only */ }

  fun pause(context: Context) {
    val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    try {
      dispatchPauseKey(audio)
    } catch (t: Throwable) {
      Log.w(TAG, "media pause key failed", t)
    }
    try {
      requestFocus(audio)
    } catch (t: Throwable) {
      Log.w(TAG, "audio focus request failed", t)
    }
  }

  fun release(context: Context) {
    val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        focusRequest?.let { audio.abandonAudioFocusRequest(it) }
        focusRequest = null
      } else if (heldLegacy) {
        @Suppress("DEPRECATION")
        audio.abandonAudioFocus(focusListener)
        heldLegacy = false
      }
      Log.i(TAG, "audio focus released")
    } catch (t: Throwable) {
      Log.w(TAG, "abandon audio focus failed", t)
    }
  }

  private fun requestFocus(audio: AudioManager) {
    val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val attrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
        .setAudioAttributes(attrs)
        .setOnAudioFocusChangeListener(focusListener)
        .setAcceptsDelayedFocusGain(false)
        .setWillPauseWhenDucked(true)
        .build()
      focusRequest = req
      audio.requestAudioFocus(req)
    } else {
      @Suppress("DEPRECATION")
      val r = audio.requestAudioFocus(
        focusListener,
        AudioManager.STREAM_MUSIC,
        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE,
      )
      heldLegacy = r == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
      r
    }
    Log.i(TAG, "audio focus result=$result (1=granted)")
  }

  private fun dispatchPauseKey(audio: AudioManager) {
    val down = KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MEDIA_PAUSE)
    val up = KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_MEDIA_PAUSE)
    audio.dispatchMediaKeyEvent(down)
    audio.dispatchMediaKeyEvent(up)
    Log.i(TAG, "dispatched MEDIA_PAUSE")
  }
}
