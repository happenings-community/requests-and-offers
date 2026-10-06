import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { termsState, saysNone } from '$lib/utils/listing-terms';

describe('termsState: not loaded is not none', () => {
  /**
   * **A listing built from a bare record, or served from cache before its links were
   * read, has empty hash arrays.** That is why the detail pages said "No service types
   * specified" about listings that had them and then filled in a moment later.
   *
   * **To make this go red:** return `'known'` when `terms_load` is undefined. The first
   * assertion flips, and so does the empty message on all four surfaces.
   */
  it('a listing nobody has read the links for is loading, not empty', () => {
    expect(termsState({}), 'no marker means nobody looked').toBe('loading');
    expect(termsState(null)).toBe('loading');
    expect(termsState(undefined)).toBe('loading');
  });

  it('a failed link read is its own state', () => {
    expect(termsState({ terms_load: 'failed' })).toBe('failed');
  });

  it('only a read that worked lets the page speak', () => {
    expect(termsState({ terms_load: 'ok' })).toBe('known');
  });

  it('"none specified" needs both a finished read and an empty list', () => {
    expect(saysNone({ terms_load: 'ok' }, []), 'read, and really empty').toBe(true);
    expect(saysNone({ terms_load: 'ok' }, undefined)).toBe(true);
    expect(saysNone({ terms_load: 'ok' }, [1]), 'it has some').toBe(false);
    expect(saysNone({}, []), 'not read yet').toBe(false);
    expect(saysNone({ terms_load: 'failed' }, []), 'read failed').toBe(false);
  });
});

/**
 * The four surfaces Sam saw it on. Source-reading, as the project has no
 * component-mounting setup; what it checks is that no empty-case sentence sits in a
 * branch that an unread listing can reach.
 */
describe('every surface waits before saying none', () => {
  const FILES = [
    'src/routes/(public)/offers/[id]/+page.svelte',
    'src/routes/(public)/requests/[id]/+page.svelte',
    'src/lib/components/offers/OfferDetailsModal.svelte',
    'src/lib/components/requests/RequestDetailsModal.svelte'
  ];

  it.each(FILES)('%s guards each empty message', (file) => {
    const source = readFileSync(file, 'utf8');
    const messages = [...source.matchAll(/No (?:service types|medium of exchange) [a-z]+\./g)];
    expect(messages.length, 'the file has empty-case wording to guard').toBeGreaterThan(0);

    for (const match of messages) {
      const before = source.slice(0, match.index);
      const branches = [...before.matchAll(/\{[:#]?(?:else )?if ([^}]+)\}|\{:else\}/g)];
      // The branch it sits in, and the two before it, which are the loading and failed
      // arms that must come first for the `{:else}` to be unreachable while unread.
      const recent = branches
        .slice(-3)
        .map((b) => b[0])
        .join(' ');
      expect(recent, `"${match[0]}" must sit after the loading and failed arms`).toContain(
        'termsState'
      );
    }
  });
});
