import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { encodeHashToBase64 } from '@holochain/client';
import { proposeHref } from '$lib/composables/domain/exchanges/useListingInterest.svelte';
import type { UIInterest } from '$lib/types/ui';

const hash = (n: number) => new Uint8Array(Array(39).fill(n));

/**
 * **The listing page's own way in: Send a proposal under Interested members.**
 *
 * This is the entry point Sam reached when the page addressed itself to him rather than
 * to the person he was proposing to. The picker had a separate bug (it sent `listingType`
 * where the page reads `type`); this link always sent `type`, so the two are tested apart
 * rather than assumed to behave alike.
 */
describe('proposeHref, from a listing page', () => {
  const interest = { interest_hash: hash(1) } as UIInterest;

  it.each(['Offer', 'Request'] as const)(
    'carries %s through as the type the page reads',
    (listingType) => {
      const url = new URL(proposeHref(interest, hash(2), listingType), 'http://localhost');
      expect(url.pathname).toBe('/exchanges/propose');
      expect(url.searchParams.get('type')).toBe(listingType);
      expect(url.searchParams.get('listing')).toBe(encodeHashToBase64(hash(2)));
      expect(url.searchParams.get('interest')).toBe(encodeHashToBase64(hash(1)));
    }
  );
});

/**
 * **The type on screen comes from the fetch that succeeded, not from the query string.**
 *
 * Sam's screenshot of his own Request 1, reached from this entry point, was headed
 * "For Request 1, with Agent 1" and labelled "AGENT 1'S OFFER". I could not reproduce the
 * wrong noun from the code: the label read `params.listingType`, which is the same value
 * that chose `getOffer` over `getRequest`, so a request could only have been labelled
 * "request". Rather than leave it resting on that reasoning, the label now reads the type
 * recorded when the listing actually loaded, which cannot disagree with the listing on
 * screen whatever the link said.
 *
 * Source-reading, like the terms-loading test, because the project has no
 * component-mounting setup.
 */
describe('the propose page labels the listing it actually loaded', () => {
  const SOURCE = 'src/routes/(public)/exchanges/propose/+page.svelte';
  const source = readFileSync(SOURCE, 'utf8');

  it('records the type from the fetch that succeeded', () => {
    expect(source).toMatch(/loadedType = listingType;/);
    const where = source.indexOf('loadedType = listingType;');
    const before = source.slice(0, where);
    expect(before, 'only after the listing is in hand').toContain('listing = item;');
  });

  it('the type label reads that, never the query string', () => {
    const label = source.slice(source.indexOf("{otherName}'s "));
    expect(label.slice(0, 60)).toContain('loadedType');
    expect(label.slice(0, 60)).not.toContain('params.listingType');
  });

  it('the other person is whoever is not proposing', () => {
    expect(source).toMatch(/const other = \$derived\(iAmAuthor \? interestedUser : creator\)/);
    expect(source).toMatch(/const otherName = \$derived\(other\?\.name/);
  });
});
