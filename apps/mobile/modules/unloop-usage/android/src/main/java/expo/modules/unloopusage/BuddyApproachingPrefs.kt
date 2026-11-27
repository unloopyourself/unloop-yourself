package expo.modules.unloopusage

import android.content.Context
import android.util.Log
import java.util.UUID

/**
 * Buddy approaching config for the native usage monitor.
 * JS timers pause while Unloop is backgrounded; the FGS still ticks, so notify
 * must live here. eventId is minted per bout so mailbox put/get stay aligned.
 */
object BuddyApproachingPrefs {
  private const val NAME = "unloop_buddy_approaching"
  private const val KEY_ENABLED = "enabled"
  private const val KEY_WARN_LEAD_MS = "warnLeadMs"
  private const val KEY_RELAY_URL = "relayUrl"
  private const val KEY_SEEKER_MAILBOX = "seekerMailboxId"
  private const val KEY_NOTIFY_MAILBOXES = "notifyMailboxesCsv"
  private const val KEY_EVENT_ID = "eventId"
  private const val KEY_APPROACHING_SENT = "approachingSent"

  fun sync(
    context: Context,
    enabled: Boolean,
    warnLeadMs: Long,
    relayUrl: String,
    seekerMailboxId: String,
    notifyMailboxesCsv: String,
  ) {
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_ENABLED, enabled)
      .putLong(KEY_WARN_LEAD_MS, warnLeadMs.coerceAtLeast(0L))
      .putString(KEY_RELAY_URL, relayUrl.trim())
      .putString(KEY_SEEKER_MAILBOX, seekerMailboxId.trim())
      .putString(KEY_NOTIFY_MAILBOXES, notifyMailboxesCsv.trim())
      .apply()
    Log.i(
      TAG,
      "sync enabled=$enabled warnLead=${warnLeadMs}ms mailboxes=${notifyMailboxesCsv.length}",
    )
  }

  fun clear(context: Context) {
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE).edit().clear().apply()
  }

  fun isEnabled(context: Context): Boolean =
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .getBoolean(KEY_ENABLED, false)

  fun warnLeadMs(context: Context): Long =
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .getLong(KEY_WARN_LEAD_MS, 120_000L)

  fun relayUrl(context: Context): String =
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .getString(KEY_RELAY_URL, "")
      ?.trim()
      .orEmpty()

  fun seekerMailboxId(context: Context): String =
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .getString(KEY_SEEKER_MAILBOX, "")
      ?.trim()
      .orEmpty()

  fun notifyMailboxIds(context: Context): List<String> =
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .getString(KEY_NOTIFY_MAILBOXES, "")
      .orEmpty()
      .split(',')
      .map { it.trim() }
      .filter { it.isNotEmpty() }

  fun eventId(context: Context): String =
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .getString(KEY_EVENT_ID, "")
      ?.trim()
      .orEmpty()

  fun approachingSent(context: Context): Boolean =
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .getBoolean(KEY_APPROACHING_SENT, false)

  /** New bout: fresh eventId, clear approaching latch. */
  fun beginBout(context: Context): String {
    val id = mintEventId()
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_EVENT_ID, id)
      .putBoolean(KEY_APPROACHING_SENT, false)
      .apply()
    Log.i(TAG, "beginBout eventId=$id")
    return id
  }

  fun markApproachingSent(context: Context) {
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_APPROACHING_SENT, true)
      .apply()
  }

  fun snapshot(context: Context): Map<String, Any> = mapOf(
    "enabled" to isEnabled(context),
    "warnLeadMs" to warnLeadMs(context).toDouble(),
    "eventId" to eventId(context),
    "approachingSent" to approachingSent(context),
    "seekerMailboxId" to seekerMailboxId(context),
    "notifyCount" to notifyMailboxIds(context).size.toDouble(),
  )

  fun mintEventId(nowMs: Long = System.currentTimeMillis()): String {
    val rand = UUID.randomUUID().toString().replace("-", "").take(6)
    return "ev_${nowMs.toString(36)}_$rand"
  }

  private const val TAG = "UnloopBuddyApproach"
}
