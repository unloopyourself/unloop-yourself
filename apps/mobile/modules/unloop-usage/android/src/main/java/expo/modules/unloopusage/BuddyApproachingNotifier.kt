package expo.modules.unloopusage

import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Best-effort POST /v1/notify/:mailboxId from the usage FGS (no React Native).
 */
object BuddyApproachingNotifier {
  private val executor = Executors.newSingleThreadExecutor()

  fun maybeNotify(
    context: Context,
    accumulatedMs: Long,
    thresholdMs: Long,
  ) {
    if (!BuddyApproachingPrefs.isEnabled(context)) return
    if (BuddyApproachingPrefs.approachingSent(context)) return
    val mailboxes = BuddyApproachingPrefs.notifyMailboxIds(context)
    if (mailboxes.isEmpty()) return
    val relay = BuddyApproachingPrefs.relayUrl(context).trimEnd('/')
    if (relay.isEmpty()) return
    val seekerMailbox = BuddyApproachingPrefs.seekerMailboxId(context)
    if (seekerMailbox.isEmpty()) return

    val warnLead = BuddyApproachingPrefs.warnLeadMs(context).coerceAtLeast(0L)
    val threshold = thresholdMs.coerceAtLeast(0L)
    // Fire when remaining usage ≤ warnLead (e.g. thr=300s lead=120s → at 180s).
    val warnAfter = (threshold - warnLead).coerceAtLeast(0L)
    if (accumulatedMs < warnAfter) return

    var eventId = BuddyApproachingPrefs.eventId(context)
    if (eventId.isEmpty()) {
      eventId = BuddyApproachingPrefs.beginBout(context)
    }
    BuddyApproachingPrefs.markApproachingSent(context)

    val remaining = (threshold - accumulatedMs.coerceAtLeast(0L)).coerceAtLeast(0L)
    val interruptAtMs = System.currentTimeMillis() + remaining
    Log.i(
      TAG,
      "approaching eventId=$eventId acc=${accumulatedMs}ms warnAfter=${warnAfter}ms thr=${threshold}ms lead=${warnLead}ms → ${mailboxes.size} buddy(ies)",
    )

    val appCtx = context.applicationContext
    executor.execute {
      for (mb in mailboxes) {
        postNotify(relay, mb, eventId, seekerMailbox, interruptAtMs)
      }
    }
  }

  private fun postNotify(
    relay: String,
    buddyMailboxId: String,
    eventId: String,
    seekerMailboxId: String,
    interruptAtMs: Long,
  ) {
    var conn: HttpURLConnection? = null
    try {
      val url = URL("$relay/v1/notify/${encode(buddyMailboxId)}")
      conn = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 8_000
        readTimeout = 8_000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
      }
      val body = JSONObject()
        .put(
          "data",
          JSONObject()
            .put("type", "approaching")
            .put("eventId", eventId)
            .put("mailboxId", seekerMailboxId)
            .put("interruptAtMs", interruptAtMs.toString()),
        )
        .toString()
      OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(body) }
      val code = conn.responseCode
      Log.i(TAG, "notify ${buddyMailboxId.take(12)}… → HTTP $code")
    } catch (t: Throwable) {
      Log.w(TAG, "notify failed for ${buddyMailboxId.take(12)}", t)
    } finally {
      conn?.disconnect()
    }
  }

  private fun encode(value: String): String =
    java.net.URLEncoder.encode(value, Charsets.UTF_8.name())

  private const val TAG = "UnloopBuddyApproach"
}
