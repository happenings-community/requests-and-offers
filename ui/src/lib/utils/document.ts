/**
 * Document structure helpers (#208).
 */

export const APP_NAME = 'Requests & Offers';

/**
 * A page's `<title>`, most specific part first, the app name last:
 * `pageTitle('Edit Offer')` is "Edit Offer - Requests & Offers", and
 * `pageTitle('Users', 'Admin')` is "Users - Admin - Requests & Offers".
 * SvelteKit's route announcer reads the title after each navigation, so this
 * is also what a screen reader hears when the page changes.
 */
export function pageTitle(...parts: (string | undefined | null | false)[]): string {
  return [
    ...parts.filter((p): p is string => typeof p === 'string' && p.trim() !== ''),
    APP_NAME
  ].join(' - ');
}

/**
 * Whether a navigation link points at the page being shown, for
 * `aria-current="page"`. A section link is current on its own pages too
 * (`/admin/users` on `/admin/users/status-history`), but `/` and `/admin` only
 * on themselves. A link with a query (`/requests?filter=my`) is current only
 * when the page carries the same values.
 */
export function isCurrentPage(href: string, url: URL): boolean {
  const target = new URL(href, url);
  const path = (p: string) => p.replace(/\/+$/, '') || '/';
  const want = path(target.pathname);
  const here = path(url.pathname);
  const pathMatches =
    want === '/' || want === '/admin'
      ? here === want
      : here === want || here.startsWith(`${want}/`);
  if (!pathMatches) return false;
  for (const [key, value] of target.searchParams) {
    if (url.searchParams.get(key) !== value) return false;
  }
  return true;
}
