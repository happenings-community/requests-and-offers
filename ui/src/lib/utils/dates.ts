/**
 * **The app's one date format** (F7, dogfooding 21 November).
 *
 * A day reads "21 Nov 2026", a time "16:38" and a moment "21 Nov 2026, 16:38", on every
 * page. The words are English whatever the browser's language, because the app is
 * written in English: following the browser put "21 nov. 2026" inside "Written up on ...
 * by Bob" for a member whose browser is French, and a member reading English sentences
 * should read English dates in them. The time zone stays the member's own.
 *
 * Every date in the app goes through here; `tests/unit/utils/dates.test.ts` fails on a
 * `toLocale*String` or `new Intl.DateTimeFormat` anywhere else.
 */

/** British English: day before month, a 24-hour clock, and no comma inside the day. */
export const DATE_LOCALE = 'en-GB';

type When = number | Date;

const asDate = (at: When): Date => (at instanceof Date ? at : new Date(at));

/** "21 Nov 2026", or "21 Nov" with `withYear: false`. Milliseconds or a Date. */
export function formatDay(at: When, { withYear = true }: { withYear?: boolean } = {}): string {
  return asDate(at).toLocaleDateString(DATE_LOCALE, {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {})
  });
}

/** "16:38". */
export function formatTime(at: When): string {
  return asDate(at).toLocaleTimeString(DATE_LOCALE, { hour: '2-digit', minute: '2-digit' });
}

/** "21 Nov 2026, 16:38". */
export function formatDateTime(at: When): string {
  return asDate(at).toLocaleString(DATE_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
