import type { RelayPort } from "@unloop/core";

/** RelayPort over the Cloudflare Worker HTTP API. */
export class HttpRelayPort implements RelayPort {
  constructor(private readonly baseUrl: string) {}

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/+$/, "")}${path}`;
  }

  async putMailbox(
    mailboxId: string,
    eventId: string,
    ciphertext: string,
    ttlSec: number,
  ): Promise<void> {
    const res = await fetch(
      this.url(
        `/v1/mailbox/${encodeURIComponent(mailboxId)}/${encodeURIComponent(eventId)}`,
      ),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ciphertext, ttlSec }),
      },
    );
    if (!res.ok) throw new Error(`relay putMailbox ${res.status}`);
  }

  async getMailbox(mailboxId: string, eventId: string): Promise<string | null> {
    const res = await fetch(
      this.url(
        `/v1/mailbox/${encodeURIComponent(mailboxId)}/${encodeURIComponent(eventId)}`,
      ),
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`relay getMailbox ${res.status}`);
    const json = (await res.json()) as { ciphertext?: string | null };
    return json.ciphertext ?? null;
  }

  async cancelMailbox(mailboxId: string, eventId: string): Promise<void> {
    const res = await fetch(
      this.url(
        `/v1/mailbox/${encodeURIComponent(mailboxId)}/${encodeURIComponent(eventId)}`,
      ),
      { method: "DELETE" },
    );
    if (!res.ok && res.status !== 404) {
      throw new Error(`relay cancelMailbox ${res.status}`);
    }
  }

  async registerPushToken(mailboxId: string, token: string): Promise<void> {
    const res = await fetch(
      this.url(`/v1/push-token/${encodeURIComponent(mailboxId)}`),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      },
    );
    if (!res.ok) throw new Error(`relay registerPushToken ${res.status}`);
  }

  async forgetPushToken(mailboxId: string): Promise<void> {
    const res = await fetch(
      this.url(`/v1/push-token/${encodeURIComponent(mailboxId)}`),
      { method: "DELETE" },
    );
    if (!res.ok && res.status !== 404) {
      throw new Error(`relay forgetPushToken ${res.status}`);
    }
  }
}
