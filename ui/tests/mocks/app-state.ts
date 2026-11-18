/**
 * `$app/state` for the test run.
 *
 * SvelteKit supplies this module at build time through its own Vite plugin, which the
 * test config does not load, so a route that imports it cannot resolve at all and could
 * not be mounted. This stands in for it, and only for the test run: nothing in `src` is
 * aliased, and a page sees the real thing in the app.
 *
 * `url` is the whole of it, because it is the whole of what our pages read. A page that
 * comes to need `params` or `data` will fail to compile here rather than silently read an
 * empty object, which is the point of keeping it this small.
 */
export const page: { url: URL } = { url: new URL('http://localhost/') };

/** Say which address the member arrived at, before the page is mounted. */
export function visit(href: string): void {
  page.url = new URL(href, 'http://localhost');
}
