import { describe, it, expect } from 'vitest';
import {
  decodedSuspensionEnd,
  remainingMs,
  suspensionEnd,
  suspensionEndDate
} from '$lib/utils/suspension';

/**
 * **A suspension's end is a Holochain timestamp** (microseconds). It was RFC 3339 text
 * that nothing validated; the zome now refuses an end that is not after its writing.
 */

const NOW_MS = Date.UTC(2026, 10, 18, 23, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

describe('suspensionEnd', () => {
  it('counts days from now and gives microseconds, an integer', () => {
    const end = suspensionEnd(7, NOW_MS);
    expect(end).toBe((NOW_MS + 7 * DAY_MS) * 1000);
    expect(Number.isInteger(end)).toBe(true);
  });
});

describe('suspensionEndDate', () => {
  it('reads microseconds, not milliseconds', () => {
    expect(suspensionEndDate(NOW_MS * 1000)?.getTime()).toBe(NOW_MS);
  });

  it('gives nothing for no end, or one that is not a number', () => {
    expect(suspensionEndDate(undefined)).toBeUndefined();
    expect(suspensionEndDate(null)).toBeUndefined();
    expect(suspensionEndDate(Number.NaN)).toBeUndefined();
  });
});

describe('remainingMs', () => {
  it('is what was left when the revision was written, in milliseconds', () => {
    const at = NOW_MS * 1000;
    expect(remainingMs(at + 3 * DAY_MS * 1000, at)).toBe(3 * DAY_MS);
  });

  it('never goes below zero, and is unknown without both times', () => {
    expect(remainingMs(1000, 5000)).toBe(0);
    expect(remainingMs(undefined, 5000)).toBeUndefined();
    expect(remainingMs(5000, undefined)).toBeUndefined();
  });
});

describe('decodedSuspensionEnd', () => {
  it('takes an integer as msgpack gives it, as a number or a bigint', () => {
    expect(decodedSuspensionEnd(1_795_000_000_000_000)).toBe(1_795_000_000_000_000);
    expect(decodedSuspensionEnd(BigInt(1_795_000_000_000_000))).toBe(1_795_000_000_000_000);
  });

  it('reads text as no end at all', () => {
    expect(decodedSuspensionEnd('2026-11-25T23:00:00.000Z')).toBeUndefined();
    expect(decodedSuspensionEnd(null)).toBeUndefined();
  });
});
