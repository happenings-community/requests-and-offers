import { describe, expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import { isCurrentPage, pageTitle } from '$lib/utils/document';

/**
 * Document structure (#208). The unit suite does not mount routes, so these
 * read the source, as `no-raw-html.test.ts` does. Each check names the rule a
 * screen reader user relies on.
 */
const pages = globSync('src/routes/**/+page.svelte');
const read = (file: string) => readFileSync(file, 'utf8');

/** Components that render a page's h1 for the routes that use them. */
const H1_FROM_COMPONENT = ['UserProfile', 'ServiceTypesActionBar', 'ServiceTypeSuggestionForm'];

describe('every route', () => {
  it('finds the routes', () => {
    expect(pages.length).toBeGreaterThan(40);
  });

  // SvelteKit's route announcer reads the title after each navigation; a
  // route with none makes it read the previous page's title.
  it('sets a title, in the one convention', () => {
    const offenders = pages.filter(
      (file) => !/<svelte:head>[\s\S]*?<title>\{pageTitle\([\s\S]*?\)\}<\/title>/.test(read(file))
    );
    expect(offenders).toEqual([]);
  });

  it('has exactly one h1', () => {
    const offenders: string[] = [];
    for (const file of pages) {
      const source = read(file);
      const own = (source.match(/<h1[\s>]/g) ?? []).length;
      const fromComponent = H1_FROM_COMPONENT.some((name) =>
        new RegExp(`<${name}[\\s/>]`).test(source)
      );
      if (own > 1 || (own === 0 && !fromComponent) || (own === 1 && fromComponent)) {
        offenders.push(`${file}: ${own} h1${fromComponent ? ' plus one from a component' : ''}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('the application shell', () => {
  const layouts = ['src/routes/+layout.svelte', 'src/routes/admin/+layout.svelte'];

  it('starts each layout with a skip link to the main content', () => {
    for (const file of layouts) {
      const source = read(file);
      expect(source, file).toMatch(/<SkipLink \/>/);
      expect(source, file).toMatch(/<main[\s\S]*?id="main-content"/);
      expect(source, file).toMatch(/<header>\s*<NavBar/);
    }
    expect(read('src/lib/components/shared/SkipLink.svelte')).toMatch(/href="#main-content"/);
  });

  // The first screen everyone sees, while the conductor connects.
  it('puts the connecting screen in a main landmark with a heading', () => {
    const source = read('src/routes/+layout.svelte');
    const connecting = source.slice(
      source.indexOf("{#if conductorStatus !== 'connected'"),
      source.indexOf('{:else if isAdminRoute}')
    );
    expect(connecting).toMatch(/^\{#if[^\n]*\n\s*<main/);
    expect(connecting).toMatch(/<h1/);
  });

  it('makes every navigation surface a labelled nav', () => {
    for (const file of [
      'src/lib/components/shared/NavBar.svelte',
      'src/lib/components/shared/drawers/MenuDrawer.svelte',
      'src/lib/components/shared/drawers/AdminMenuDrawer.svelte',
      'src/lib/components/users/AdminSideBar.svelte'
    ]) {
      expect(read(file), file).toMatch(/<nav\s+aria-label="[^"]+"/);
    }
  });

  it('marks the current page on navigation links', () => {
    expect(read('src/lib/components/shared/MenuLink.svelte')).toMatch(
      /aria-current=\{isCurrentPage\(/
    );
    for (const file of [
      'src/lib/components/shared/NavBar.svelte',
      'src/lib/components/shared/drawers/MenuDrawer.svelte'
    ]) {
      const source = read(file);
      const links = (source.match(/<a\n\s+href="\//g) ?? []).length;
      const marked = (source.match(/<a\n\s+href="\/[^"]*"\n\s+aria-current=\{current\(/g) ?? [])
        .length;
      expect(marked, file).toBe(links);
    }
  });
});

describe('pageTitle', () => {
  it('puts the most specific part first and the app last', () => {
    expect(pageTitle('Edit Offer')).toBe('Edit Offer - Requests & Offers');
    expect(pageTitle('Users', 'Admin')).toBe('Users - Admin - Requests & Offers');
    expect(pageTitle()).toBe('Requests & Offers');
    expect(pageTitle(undefined, '', 'Offers')).toBe('Offers - Requests & Offers');
  });
});

describe('isCurrentPage', () => {
  const at = (path: string) => new URL(path, 'http://localhost');

  it('matches a section on its own pages', () => {
    expect(isCurrentPage('/admin/users', at('/admin/users'))).toBe(true);
    expect(isCurrentPage('/admin/users', at('/admin/users/status-history'))).toBe(true);
    expect(isCurrentPage('/admin/users', at('/admin/userstuff'))).toBe(false);
  });

  it('matches home and the admin dashboard only on themselves', () => {
    expect(isCurrentPage('/', at('/'))).toBe(true);
    expect(isCurrentPage('/', at('/offers'))).toBe(false);
    expect(isCurrentPage('/admin', at('/admin'))).toBe(true);
    expect(isCurrentPage('/admin', at('/admin/users'))).toBe(false);
  });

  it('needs the query a link names', () => {
    expect(isCurrentPage('/requests?filter=my', at('/requests?filter=my'))).toBe(true);
    expect(isCurrentPage('/requests?filter=my', at('/requests'))).toBe(false);
    expect(isCurrentPage('/requests', at('/requests?filter=my'))).toBe(true);
  });
});
