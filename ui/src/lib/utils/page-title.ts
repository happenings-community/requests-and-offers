/**
 * **Every page's title, written one way** (F5, dogfooding 21 November).
 *
 * "<Page> · Requests & Offers", or "<Page> · Admin · Requests & Offers" in a section. The
 * suffix is the app's name as its header shows it; the titles that existed before used
 * four suffixes between them and no majority. A route without a title left SvelteKit's
 * announcer reading "untitled page"; `tests/unit/utils/page-title.test.ts` fails on any
 * route that does not set one through here.
 */

export const APP_NAME = 'Requests & Offers';

export function pageTitle(...parts: string[]): string {
  return [...parts.filter((part) => part.trim() !== ''), APP_NAME].join(' · ');
}
