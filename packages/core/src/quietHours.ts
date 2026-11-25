/**
 * Quiet-hours window for Buddy push (ADR-010 / P3-07).
 * [startHour, endHour) in local 0–23; overnight wrap when start > end.
 */
export function isInQuietHours(
  hour: number,
  startHour: number,
  endHour: number,
): boolean {
  const h = ((hour % 24) + 24) % 24;
  const s = ((startHour % 24) + 24) % 24;
  const e = ((endHour % 24) + 24) % 24;
  if (s === e) return false;
  if (s < e) return h >= s && h < e;
  return h >= s || h < e;
}
