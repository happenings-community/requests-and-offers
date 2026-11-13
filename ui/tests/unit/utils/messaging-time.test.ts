import { describe, it, expect } from 'vitest';
import { formatMessageTime } from '$lib/utils/messaging-threads';

/**
 * A message's time, as a conversation shows it. An old message showed hour and minute
 * only, so last month's "14:05" read as today's.
 */
describe('formatMessageTime', () => {
  const now = new Date(2026, 10, 13, 18, 0).getTime();

  it('shows the time alone for a message sent today', () => {
    const at = new Date(2026, 10, 13, 9, 5).getTime();
    expect(formatMessageTime(at, now)).toBe('09:05');
  });

  it('adds the date for a message from another day this year', () => {
    const at = new Date(2026, 9, 4, 14, 5).getTime();
    expect(formatMessageTime(at, now)).toBe('4 Oct, 14:05');
  });

  it('adds the year once it differs', () => {
    const at = new Date(2025, 11, 31, 23, 59).getTime();
    expect(formatMessageTime(at, now)).toBe('31 Dec 2025, 23:59');
  });
});
