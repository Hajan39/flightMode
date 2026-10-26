/**
 * Pure sleep-timer decision: stop once the wall-clock deadline has passed.
 * `endAt === null` means no timer is set.
 */
export function shouldStopForSleepTimer(
  endAt: number | null,
  now: number
): boolean {
  return endAt !== null && Number.isFinite(endAt) && now >= endAt;
}
