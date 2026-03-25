/**
 * Event start times from the API are ISO 8601 instants (UTC with Z or offset).
 * Always parse with Date(iso) — never strip "Z"; that treats UTC as local and shifts the clock time.
 */

export function parseEventStart(iso: string | null | undefined): Date | null {
  if (iso == null || String(iso).trim() === '') return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatEventStartForDisplay(iso: string | null | undefined): string {
  const d = parseEventStart(iso);
  if (!d) return 'No time set';
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
