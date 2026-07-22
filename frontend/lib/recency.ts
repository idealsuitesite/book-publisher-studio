/**
 * Humanises a project's `updatedAt` for the Home hero card (HOME_TIGHTEN_SCOPE Point B1).
 * "Worked on", deliberately — `updatedAt` bumps on every WRITE (edit, snapshot, settings) and
 * never on a read-only open (ADR-0027 discipline), so the honest phrase is "worked on", not
 * "opened" (the §0.2 nuance, disclosed there and encoded here).
 */
export function recencyLabel(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return 'Worked on today';
  if (days === 1) return 'Worked on yesterday';
  if (days < 30) return `Worked on ${days} days ago`;
  return `Last worked on ${then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
