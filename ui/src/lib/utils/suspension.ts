/**
 * A temporary suspension's end (`Status.suspended_until`) is a Holochain timestamp:
 * microseconds since the epoch, an integer. It used to be RFC 3339 text that nothing
 * validated. Every place that writes one or reads one goes through here, so the unit
 * is converted in one file.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** The end of a suspension of `days` days from `nowMs`, as a Holochain timestamp. */
export function suspensionEnd(days: number, nowMs: number = Date.now()): number {
  return Math.round(nowMs + days * DAY_MS) * 1000;
}

/** A suspension's end as a Date, or undefined when there is none or it is not a number. */
export function suspensionEndDate(micros: number | null | undefined): Date | undefined {
  if (typeof micros !== 'number' || !Number.isFinite(micros)) return undefined;
  return new Date(micros / 1000);
}

/**
 * How long a suspension had left at `atMicros` (a status revision's action timestamp),
 * in milliseconds, never below zero. Both are microseconds.
 */
export function remainingMs(
  untilMicros: number | null | undefined,
  atMicros: number | null | undefined
): number | undefined {
  if (typeof untilMicros !== 'number' || typeof atMicros !== 'number') return undefined;
  return Math.max(0, Math.floor((untilMicros - atMicros) / 1000));
}

/**
 * A suspension's end as decoded from a record: msgpack gives an integer, as a number or,
 * for a value past 2^53, a bigint. Anything else (the text an older record held) is no
 * end at all.
 */
export function decodedSuspensionEnd(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  return undefined;
}
