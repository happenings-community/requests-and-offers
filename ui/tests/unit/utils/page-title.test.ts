import { describe, it, expect } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import { pageTitle, APP_NAME } from '$lib/utils/page-title';

/**
 * **Every page names itself, the same way (F5, dogfooding 21 November).**
 *
 * 29 of 48 routes set no title, so the tab read the bare address and SvelteKit's route
 * announcer told a screen reader "untitled page" on every navigation. The titles that
 * did exist disagreed: "Offers | Happening Community", "My Listings - Requests & Offers",
 * "Manage Mediums of Exchange - Admin". One helper writes "<Page> · Requests & Offers",
 * the app's name as its header shows it.
 */
describe('pageTitle', () => {
  it('ends with the app name', () => {
    expect(APP_NAME).toBe('Requests & Offers');
    expect(pageTitle('Offers')).toBe('Offers · Requests & Offers');
  });

  it('joins a section between the page and the app name', () => {
    expect(pageTitle('Users', 'Admin')).toBe('Users · Admin · Requests & Offers');
  });

  it('is the app name alone when there is no page name yet', () => {
    expect(pageTitle('')).toBe('Requests & Offers');
  });
});

/**
 * **To make this go red:** add a route without `<title>{pageTitle(...)}</title>`, or with a
 * title written by hand.
 */
describe('every route', () => {
  const routes = globSync('src/routes/**/+page.svelte');

  it('finds the routes', () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  it('sets its title through pageTitle', () => {
    const offenders = routes.filter(
      (file) => !/<title>\{pageTitle\(/.test(readFileSync(file, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });
});

/**
 * **The membership wall names itself** (final alpha 2 dogfooding). ProfileGuard renders
 * the wall instead of the page, so the page's own title never rendered and the tab kept
 * the previous page's ("My profile · Requests & Offers" on /offers).
 */
describe('the membership wall', () => {
  it('sets its title through pageTitle', () => {
    const guard = readFileSync('src/lib/components/common/ProfileGuard.svelte', 'utf8');
    expect(guard).toMatch(/<svelte:head>[\s\S]*<title>\{pageTitle\(/);
  });
});
