import { describe, it, expect } from 'vitest';
import { isExternalHref, normalizeHref } from '$lib/utils/links';

describe('normalizeHref', () => {
  it.each([
    ['example.com', 'https://example.com'],
    ['example.com/page', 'https://example.com/page'],
    ['www.example.com/page?q=1#x', 'https://www.example.com/page?q=1#x'],
    ['sub.example.co.uk', 'https://sub.example.co.uk'],
    ['example.com:8080/x', 'https://example.com:8080/x'],
    ['localhost:3000', 'https://localhost:3000'],
    ['192.168.1.10/admin', 'https://192.168.1.10/admin'],
    ['//example.com/x', 'https://example.com/x'],
    ['  example.com  ', 'https://example.com']
  ])('gives %s a safe scheme', (input, expected) => {
    expect(normalizeHref(input)).toBe(expected);
  });

  it.each([
    'https://example.com/x',
    'http://example.com/plain',
    'mailto:someone@example.com',
    'tel:+15145550000',
    '/requests/abc',
    '#section',
    '?page=2',
    './relative',
    'notahost',
    ''
  ])('leaves %s unchanged', (input) => {
    expect(normalizeHref(input)).toBe(input);
  });
});

describe('isExternalHref', () => {
  it.each(['https://example.com', 'http://example.com', 'mailto:a@b.org', 'tel:+1'])(
    'treats %s as external',
    (href) => {
      expect(isExternalHref(href)).toBe(true);
    }
  );

  it.each(['/requests/abc', '#top', 'example.com', 'webhapp://webhappwindow/x'])(
    'treats %s as internal',
    (href) => {
      expect(isExternalHref(href)).toBe(false);
    }
  );
});
