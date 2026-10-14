import { describe, it, expect } from 'vitest';
import { BLOCKED_HREF, isExternalHref, normalizeHref } from '$lib/utils/links';

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

describe('normalizeHref with protocol-relative spellings', () => {
  // Each of these resolves to https://evil.example/ through the URL parser on an
  // http(s) page, so none of them may be left looking like an internal path.
  it.each([
    ['/\\evil.example/x', 'https://evil.example/x'],
    ['\\\\evil.example/x', 'https://evil.example/x'],
    ['\\/evil.example/x', 'https://evil.example/x'],
    ['///evil.example/x', 'https://evil.example/x'],
    ['/\t/evil.example/x', 'https://evil.example/x'],
    ['/\n/evil.example/x', 'https://evil.example/x'],
    [' //evil.example/x', 'https://evil.example/x']
  ])('gives %j the https scheme the browser would resolve it to', (input, expected) => {
    expect(new URL(input, 'https://app.example/page').href).toBe(new URL(expected).href);
    expect(normalizeHref(input)).toBe(expected);
    expect(isExternalHref(normalizeHref(input))).toBe(true);
  });

  it('leaves a single leading backslash, which stays on the current host, as a path', () => {
    expect(new URL('\\requests/abc', 'https://app.example/page').host).toBe('app.example');
    expect(normalizeHref('\\requests/abc')).toBe('\\requests/abc');
  });
});

describe('normalizeHref with script-capable schemes', () => {
  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    '  javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<script>alert(1)</script>'
  ])('neutralises %s', (input) => {
    expect(normalizeHref(input)).toBe(BLOCKED_HREF);
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
