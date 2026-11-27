/**
 * Buddy-side lockout: live compose ends this many ms before U's interrupt.
 * Default 30s (P3.5-09).
 */
export const DEFAULT_BUDDY_LOCKOUT_LEAD_MS = 30_000;

/** Wall-clock when live compose / notification should close. */
export function lockoutAtMs(
  interruptAtMs: number,
  lockoutLeadMs: number = DEFAULT_BUDDY_LOCKOUT_LEAD_MS,
): number {
  return interruptAtMs - Math.max(0, lockoutLeadMs);
}

export function isPastLockout(
  nowMs: number,
  interruptAtMs: number,
  lockoutLeadMs: number = DEFAULT_BUDDY_LOCKOUT_LEAD_MS,
): boolean {
  return nowMs >= lockoutAtMs(interruptAtMs, lockoutLeadMs);
}

/**
 * Next index in a round-robin over `length` items given the previous index
 * (−1 or out of range → start at 0).
 */
export function nextRoundRobinIndex(length: number, lastIndex: number): number {
  if (length <= 0) return -1;
  if (lastIndex < 0 || lastIndex >= length) return 0;
  return (lastIndex + 1) % length;
}
