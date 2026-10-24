import { writable } from 'svelte/store';

/**
 * `$app/stores` for the test run, for the same reason as `app-state.ts`: SvelteKit
 * supplies it at build time, and a route reading `$page.params` cannot be mounted here
 * without a stand-in. Nothing in `src` is aliased.
 */
export const page = writable<{ params: Record<string, string>; url: URL }>({
  params: {},
  url: new URL('http://localhost/')
});

/** Say which route parameters the member arrived with, before the page is mounted. */
export function setPage(params: Record<string, string>, href = '/'): void {
  page.set({ params, url: new URL(href, 'http://localhost') });
}
