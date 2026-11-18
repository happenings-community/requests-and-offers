import { describe, it, expect } from 'vitest';
import {
  listingCounts,
  listingsFor,
  openingView,
  viewFromQuery,
  type MyListingSets
} from '$lib/utils/my-listings';
import type { UIOffer, UIRequest } from '$lib/types/ui';

const hash = (n: number) => new Uint8Array([n, n, n, n]);
const listing = (n: number, at: number) =>
  ({ original_action_hash: hash(n), title: `L${n}`, created_at: at }) as unknown as UIRequest &
    UIOffer;

const sets = (): MyListingSets => ({
  activeRequests: [listing(1, 100), listing(2, 300)],
  activeOffers: [listing(3, 200)],
  archivedRequests: [listing(4, 50)],
  archivedOffers: [listing(5, 400)]
});

const titles = (view: Parameters<typeof listingsFor>[0]) =>
  listingsFor(view, sets()).map((m) => `${m.kind}:${m.listing.title}:${m.archived}`);

describe('My Listings views (#344)', () => {
  it('shows active requests and active offers apart, newest first', () => {
    expect(titles('requests')).toEqual(['Request:L2:false', 'Request:L1:false']);
    expect(titles('offers')).toEqual(['Offer:L3:false']);
  });

  it('shows archived requests and offers together, newest first', () => {
    expect(titles('archived')).toEqual(['Offer:L5:true', 'Request:L4:true']);
  });

  it('counts each view', () => {
    expect(listingCounts(sets())).toEqual({ requests: 2, offers: 1, archived: 2 });
  });

  it('orders by the last edit when there is one', () => {
    const s = sets();
    s.activeRequests[1] = { ...s.activeRequests[1], created_at: 10 };
    s.activeRequests[0] = { ...s.activeRequests[0], updated_at: 500 };
    expect(listingsFor('requests', s).map((m) => m.listing.title)).toEqual(['L1', 'L2']);
  });
});

describe('My Listings opens the view a link asks for (#353 review)', () => {
  it('opens Offers or Archived when asked, and Requests otherwise', () => {
    expect(viewFromQuery('offers')).toBe('offers');
    expect(viewFromQuery('archived')).toBe('archived');
    expect(viewFromQuery('requests')).toBe('requests');
    expect(viewFromQuery(null)).toBe('requests');
    expect(viewFromQuery('Offers')).toBe('requests');
    expect(viewFromQuery('anything')).toBe('requests');
  });
});

describe('My Listings comes back to the view you last had (Sam, 18 November)', () => {
  it('opens the view a link asks for, else the one remembered, else Requests', () => {
    expect(openingView('offers', 'archived')).toBe('offers');
    expect(openingView(null, 'archived')).toBe('archived');
    expect(openingView(null, null)).toBe('requests');
    expect(openingView(null, 'nonsense')).toBe('requests');
    // A view the app does not know is no view at all: the remembered one still opens.
    expect(openingView('nonsense', 'archived')).toBe('archived');
    expect(openingView('requests', 'archived')).toBe('requests');
  });
});
