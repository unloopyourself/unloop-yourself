import type { StoragePort } from "@unloop/core";

const AUDIT_KEY = "audit.trail";

export type AuditEvent = {
  readonly type: string;
  readonly atMs: number;
  readonly detail?: string;
};

/** Append-only on-device audit lines (local JSON array). No network. */
export class LocalAuditTrail {
  constructor(private readonly storage: StoragePort) {}

  async append(event: AuditEvent): Promise<void> {
    const existing = await this.storage.getString(AUDIT_KEY);
    const list: AuditEvent[] = existing ? (JSON.parse(existing) as AuditEvent[]) : [];
    list.push(event);
    // Cap to last 200 events to bound local storage.
    const trimmed = list.slice(-200);
    await this.storage.setString(AUDIT_KEY, JSON.stringify(trimmed));
  }

  async readAll(): Promise<AuditEvent[]> {
    const existing = await this.storage.getString(AUDIT_KEY);
    return existing ? (JSON.parse(existing) as AuditEvent[]) : [];
  }
}
