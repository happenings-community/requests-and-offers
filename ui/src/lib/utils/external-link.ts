/**
 * The address to open for a link another member typed, or `null` if it is not one we
 * open.
 *
 * Listings and organisations carry links as free text, and the network accepts any
 * string. Rendered straight into `href`, a `javascript:` or `data:` "link" would run
 * as code when clicked. So only `http:` and `https:` become links; anything else is
 * shown as text.
 *
 * A bare address such as `example.org` or `www.example.org/page` is taken as `https:`,
 * which is what a member typing it means. It has no scheme of its own, so it cannot
 * smuggle one in.
 */
export function externalHref(text: string | null | undefined): string | null {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return null;
  const candidate = BARE_ADDRESS.test(trimmed) ? `https://${trimmed}` : trimmed;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
}

/**
 * A host name with a dot and no scheme, optionally with a port and then a path, query or
 * fragment: `example.org/x`, `example.org?ref=ro`, `example.org:8080/x`.
 *
 * The dot is required, so `localhost` and other single-label names stay text: a link a
 * member typed should not open a service on the viewer's own machine.
 */
const BARE_ADDRESS = /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d{1,5})?([/?#]\S*)?$/i;
