import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// #349 review: Send a proposal is a member act. The zome refuses a proposal from
// anyone who is not an accepted member, so an owner who has been suspended but
// still has listings must not be offered the link. Both places an owner sees who
// is interested gate it on the composable's `canAct`. The suite does not mount
// components (see ContactModal.test.ts), so this reads the markup.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

/** The `{#if …}` / `{:else if …}` guards still open at the given offset. */
function openGuards(markup: string, at: number): string[] {
  const open: string[] = [];
  const re = /\{(#if|:else if|:else|\/if)([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup)) && m.index < at) {
    if (m[1] === '#if') open.push(m[2].trim());
    else if (m[1] === ':else if' || m[1] === ':else') open[open.length - 1] = m[2].trim();
    else open.pop();
  }
  return open;
}

const cases = [
  ['the My Listings card', 'src/lib/components/shared/listings/MyListingCard.svelte'],
  ['the listing page', 'src/lib/components/exchanges/ListingInterest.svelte']
] as const;

describe('Send a proposal is offered only to a member who may act (#349 review)', () => {
  for (const [where, path] of cases) {
    it(`on ${where}, every Send a proposal to an interested member sits inside a canAct guard`, () => {
      const source = read(path);
      const markup = source.slice(source.indexOf('</script>'));
      const links = [...markup.matchAll(/Send a proposal/g)].map((m) => m.index!);
      expect(links.length).toBeGreaterThan(0);
      for (const at of links) {
        const guards = openGuards(markup, at);
        expect(
          guards.some((g) => /\bcanAct\b/.test(g)),
          `"Send a proposal" at offset ${at} in ${path} is guarded by [${guards.join(' | ')}], none of which checks canAct`
        ).toBe(true);
      }
    });
  }
});
