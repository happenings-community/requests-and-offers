import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// U14: the hREA dashboard is the admin's hREA entry, integrated rather than
// bolted on. The suite does not mount components (see markdown-wiring.test.ts),
// so these checks read the source.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('admin hREA entry', () => {
  it('lives at /admin/hrea with the dashboard first and the test managers as a tab of the same page', () => {
    const page = read('src/routes/admin/hrea/+page.svelte');
    expect(page).toMatch(
      /import HreaDashboard from '\$lib\/components\/hrea\/HreaDashboard.svelte'/
    );
    expect(page).toMatch(
      /import HREATestInterface from '\$lib\/components\/hrea\/HREATestInterface.svelte'/
    );
    expect(page).toMatch(/<Tab bind:group=\{tab\} name="dashboard" value=\{0\}>/);
    expect(page).toMatch(/<Tab bind:group=\{tab\} name="test-managers" value=\{1\}>/);
  });

  it('sends the old /admin/hrea-test address to the test managers tab, with no second page left', () => {
    expect(existsSync(resolve(process.cwd(), 'src/routes/admin/hrea-test/+page.svelte'))).toBe(
      false
    );
    expect(read('src/routes/admin/hrea-test/+page.ts')).toMatch(/redirect\(308,/);
  });

  it('keeps the query string through the redirect, so connection parameters survive it', async () => {
    const { load } = await import('../../../../src/routes/admin/hrea-test/+page');
    const url = new URL('http://localhost/admin/hrea-test?hcPort=1234&hcToken=abc');
    let location = '';
    try {
      (load as (e: { url: URL }) => unknown)({ url });
    } catch (e) {
      location = (e as { location: string }).location;
    }
    const target = new URL(location, 'http://localhost');
    expect(target.pathname).toBe('/admin/hrea');
    expect(target.searchParams.get('tab')).toBe('test');
    expect(target.searchParams.get('hcPort')).toBe('1234');
    expect(target.searchParams.get('hcToken')).toBe('abc');
  });

  it('is what the admin sidebar links to', () => {
    const nav = read('src/lib/components/users/AdminSideBar.svelte');
    expect(nav).toMatch(/<MenuLink href="\/admin\/hrea">/);
    expect(nav).not.toMatch(/hrea-test/);
  });

  it('reads its numbers from hREA through the store, never from the prototype mock', () => {
    const dashboard = read('src/lib/components/hrea/HreaDashboard.svelte');
    const composable = read('src/lib/composables/domain/hrea/useHreaDashboard.svelte.ts');
    expect(composable).toMatch(/hreaStore\.loadAuditSnapshot\(\)/);
    expect(dashboard).not.toMatch(/\$lib\/mock|appState/);
    expect(dashboard).toMatch(/KNOWN_MAPPING_GAPS/);
  });

  it('presents flow nodes as a list of items, never as buttons that do nothing', () => {
    const dashboard = read('src/lib/components/hrea/HreaDashboard.svelte');
    expect(dashboard).not.toMatch(/role="button"/);
    expect(dashboard).toMatch(/class="hrea-stage"[^>]*role="list"/s);
    expect(dashboard).toMatch(/role="listitem"/);
  });

  it('shows a ledger row caveat when the row carries one', () => {
    const dashboard = read('src/lib/components/hrea/HreaDashboard.svelte');
    expect(dashboard).toMatch(/\{#if r\.caveat\}/);
  });

  it('draws the event to its Commitment as a fulfills link, no longer as not mirrored', () => {
    const dashboard = read('src/lib/components/hrea/HreaDashboard.svelte');
    expect(dashboard).not.toMatch(/not mirrored/);
    expect(dashboard).toMatch(/label: 'fulfills'/);
  });
});
