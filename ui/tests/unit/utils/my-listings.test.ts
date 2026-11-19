import { describe, it, expect } from 'vitest';
import { listingCounts, listingsFor, type MyListingSets } from '$lib/utils/my-listings';
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
