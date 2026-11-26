/**
 * Unloop Buddy relay — opaque TTL mailbox + push-token registry.
 * Sees ciphertext and routing ids only (ADR-006 / ADR-010).
 */

import { parseServiceAccount, sendFcmDataMessage } from "./fcm";

export interface Env {
  MAILBOX?: KVNamespace;
  RELAY_TTL_DEFAULT_SEC?: string;
  /** Full Firebase service-account JSON (wrangler secret). */
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

type Json = Record<string, unknown>;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: Json, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function bad(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function defaultTtl(env: Env): number {
  const n = Number(env.RELAY_TTL_DEFAULT_SEC ?? "120");
  return Number.isFinite(n) && n > 0 ? Math.min(n, 600) : 120;
}

/** Max mailbox ciphertext UTF-8 bytes (Phase 3.5 media caps). */
export const MAILBOX_CIPHERTEXT_MAX_BYTES = 8 * 1024 * 1024;

function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function mailboxKey(mailboxId: string, eventId: string): string {
  return `mb:${mailboxId}:${eventId}`;
}

function tokenKey(mailboxId: string): string {
  return `tok:${mailboxId}`;
}

async function readJson(request: Request): Promise<Json | null> {
  try {
    return (await request.json()) as Json;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/" || path === "/health") {
      return json({
        ok: true,
        service: "unloop-relay",
        kv: Boolean(env.MAILBOX),
      });
    }

    if (!env.MAILBOX) {
      return bad("MAILBOX KV binding not configured", 503);
    }

    // PUT /v1/mailbox/:mailboxId/:eventId  body: { ciphertext, ttlSec? }
    const putMatch = path.match(/^\/v1\/mailbox\/([^/]+)\/([^/]+)$/);
    if (putMatch && request.method === "PUT") {
      const mailboxId = decodeURIComponent(putMatch[1]!);
      const eventId = decodeURIComponent(putMatch[2]!);
      const body = await readJson(request);
      if (!body || typeof body.ciphertext !== "string" || !body.ciphertext) {
        return bad("ciphertext required");
      }
      if (utf8ByteLength(body.ciphertext) > MAILBOX_CIPHERTEXT_MAX_BYTES) {
        return bad("ciphertext too large", 413);
      }
      const ttl =
        typeof body.ttlSec === "number" && body.ttlSec > 0
          ? Math.min(body.ttlSec, 600)
          : defaultTtl(env);
      await env.MAILBOX.put(mailboxKey(mailboxId, eventId), body.ciphertext, {
        expirationTtl: Math.max(60, Math.floor(ttl)),
      });
      return json({ ok: true, ttlSec: ttl });
    }

    // GET /v1/mailbox/:mailboxId/:eventId
    if (putMatch && request.method === "GET") {
      const mailboxId = decodeURIComponent(putMatch[1]!);
      const eventId = decodeURIComponent(putMatch[2]!);
      const ciphertext = await env.MAILBOX.get(mailboxKey(mailboxId, eventId));
      if (ciphertext == null) return json({ ciphertext: null }, 404);
      return json({ ciphertext });
    }

    // DELETE /v1/mailbox/:mailboxId/:eventId  (cancel)
    if (putMatch && request.method === "DELETE") {
      const mailboxId = decodeURIComponent(putMatch[1]!);
      const eventId = decodeURIComponent(putMatch[2]!);
      await env.MAILBOX.delete(mailboxKey(mailboxId, eventId));
      return json({ ok: true });
    }

    // PUT /v1/push-token/:mailboxId  body: { token }
    const tokMatch = path.match(/^\/v1\/push-token\/([^/]+)$/);
    if (tokMatch && request.method === "PUT") {
      const mailboxId = decodeURIComponent(tokMatch[1]!);
      const body = await readJson(request);
      if (!body || typeof body.token !== "string" || !body.token) {
        return bad("token required");
      }
      await env.MAILBOX.put(tokenKey(mailboxId), body.token);
      return json({ ok: true });
    }

    // DELETE /v1/push-token/:mailboxId
    if (tokMatch && request.method === "DELETE") {
      const mailboxId = decodeURIComponent(tokMatch[1]!);
      await env.MAILBOX.delete(tokenKey(mailboxId));
      return json({ ok: true });
    }

    // POST /v1/notify/:mailboxId  body: { data?: Record<string,string> }
    const notifyMatch = path.match(/^\/v1\/notify\/([^/]+)$/);
    if (notifyMatch && request.method === "POST") {
      const mailboxId = decodeURIComponent(notifyMatch[1]!);
      const token = await env.MAILBOX.get(tokenKey(mailboxId));
      if (!token) return bad("no push token for mailbox", 404);
      const sa = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (!sa) {
        return json({
          ok: false,
          hasToken: true,
          error: "FIREBASE_SERVICE_ACCOUNT_JSON secret missing",
        }, 503);
      }
      const body = (await readJson(request)) ?? {};
      const dataRaw =
        body.data && typeof body.data === "object" && !Array.isArray(body.data)
          ? (body.data as Record<string, unknown>)
          : { type: "nudge", mailboxId };
      const data: Record<string, string> = {};
      for (const [k, v] of Object.entries(dataRaw)) {
        data[k] = typeof v === "string" ? v : JSON.stringify(v);
      }
      try {
        const result = await sendFcmDataMessage(sa, token, data);
        return json({
          ok: result.ok,
          status: result.status,
          fcm: result.body,
        }, result.ok ? 200 : 502);
      } catch (e) {
        return json({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        }, 502);
      }
    }

    return bad("not found", 404);
  },
};
