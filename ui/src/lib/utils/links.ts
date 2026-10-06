/**
 * Link normalisation for user-entered URLs.
 *
 * In the desktop shell the app is served from a custom scheme (`webhapp://`).
 * A scheme-less href such as `example.com` resolves against the current page
 * and is taken by the SvelteKit router as an internal route, which renders the
 * 404 page. A protocol-relative `//host` picks up the `webhapp:` scheme the
 * same way. Normalising these to `https://` lets the shell open them in the
 * system browser.
 */

const HOST_LIKE =
  /^(?:localhost|\d{1,3}(?:\.\d{1,3}){3}|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9])(?::\d{1,5})?(?:[/?#]|$)/i;

const EXTERNAL_SCHEME = /^(?:https?|mailto|tel):/i;

/**
 * Returns the href with a safe scheme when it points outside the app.
 *
 * - `//host/path` becomes `https://host/path`
 * - `example.com/path` (no scheme, looks like a host) becomes `https://example.com/path`
 * - absolute URLs (`https:`, `mailto:` ...) and internal paths (`/requests/1`, `#top`, `?q`) are unchanged
 */
export function normalizeHref(href: string): string {
  const trimmed = href.trim();
  if (trimmed === '') return trimmed;

  if (trimmed.startsWith('//')) return `https:${trimmed}`;

  if (/^[/#?.]/.test(trimmed)) return trimmed;

  // `example.com:8080/x` is a host with a port, not a URL with scheme `example.com`.
  if (HOST_LIKE.test(trimmed)) return `https://${trimmed}`;

  return trimmed;
}

/** True when the (normalised) href should leave the app instead of routing inside it. */
export function isExternalHref(href: string): boolean {
  return EXTERNAL_SCHEME.test(href.trim());
}
