import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { readFileSync } from 'node:fs';
import PageHeader from '$lib/components/shared/PageHeader.svelte';

describe('PageHeader', () => {
  it('draws the title as the page heading, bold and at the left, with its line and buttons', () => {
    const actions = createRawSnippet(() => ({ render: () => '<a href="/x">+ Offer</a>' }));
    render(PageHeader, { title: 'Offers', subtitle: 'What members are offering', actions });

    const h1 = screen.getByRole('heading', { level: 1, name: 'Offers' });
    expect(h1.className).toContain('font-bold');
    expect(h1.className).not.toContain('text-center');
    expect(screen.getByText('What members are offering')).toBeTruthy();
    expect(screen.getByRole('link', { name: '+ Offer' })).toBeTruthy();
  });

  it('leaves out the line and the buttons when a page has none', () => {
    render(PageHeader, { title: 'Blocked members' });
    const header = screen.getByTestId('page-header');
    expect(header.querySelectorAll('p')).toHaveLength(0);
    expect(header.children).toHaveLength(1);
  });
});

/**
 * Every list page draws its title through PageHeader, so the titles stay one size, weight
 * and alignment (Sam's walk, 20 November: My Listings bold, My Exchanges regular, Users and
 * Organizations centred, Requests and Offers untitled). Read from the source: the pages need
 * their stores to render. **To make it go red:** give one of these pages its own `<h1>`.
 */
describe('list pages', () => {
  const PAGES: Record<string, string> = {
    'My Exchanges': 'exchanges',
    'My Listings': 'my-listings',
    Messages: 'messages',
    'Blocked members': 'messages/blocked',
    Requests: 'requests',
    Offers: 'offers',
    'All Users': 'users',
    Organizations: 'organizations',
    'Service Types': 'service-types'
  };

  it.each(Object.entries(PAGES))('%s takes its title from PageHeader', (_, route) => {
    const page = readFileSync(`src/routes/(public)/${route}/+page.svelte`, 'utf8');
    expect(page).toContain('<PageHeader');
    expect(page).not.toMatch(/<h1[\s>]/);
    expect(page).not.toMatch(/class="h1[^"]*"/);
  });

  it('titles the Community pages as the menu names them', () => {
    const nav = readFileSync('src/lib/components/shared/NavBar.svelte', 'utf8');
    for (const [title, route] of [
      ['All Users', 'users'],
      ['Organizations', 'organizations'],
      ['Service Types', 'service-types']
    ]) {
      expect(nav).toContain(`label: '${title}'`);
      const page = readFileSync(`src/routes/(public)/${route}/+page.svelte`, 'utf8');
      expect(page).toContain(`title="${title}"`);
    }
  });
});

/**
 * A search that matches none of a list that has some says so, with nothing to create:
 * before, it read "No active requests yet." with a create button, under a line saying
 * "Showing 0 of 10" (cold review, 20 November). Read from the source, as above.
 * **To make it go red:** drop the `filteredRequests.length > 0` branch.
 */
describe('an empty list after a search', () => {
  it.each([
    ['requests', 'Requests', 'requestCreate'],
    ['offers', 'Offers', 'offerCreate']
  ])('on %s, says nothing matches, and offers nothing to create', (route, kind, create) => {
    const page = readFileSync(`src/routes/(public)/${route}/+page.svelte`, 'utf8');
    const empty = page.slice(page.indexOf('<div class="card space-y-3 p-6 text-center">'));
    const matchesNone = empty.indexOf(`{#if management.filtered${kind}.length > 0}`);
    expect(matchesNone).toBeGreaterThan(-1);
    expect(empty.slice(matchesNone)).toMatch(new RegExp(`No ${route} match your search`));
    const button = empty.indexOf(`paths.${create}()`);
    const guard = empty.lastIndexOf('{#if', button);
    expect(empty.slice(guard, button)).toContain(`management.filtered${kind}.length === 0`);
  });
});
