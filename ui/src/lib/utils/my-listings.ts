import type { ListingType } from '$lib/types/holochain';
import type { UIOffer, UIRequest } from '$lib/types/ui';

/**
 * My Listings (#344): the three views the count cards choose between, and the
 * listings each one shows. Archived holds both kinds together.
 */

export type ListingView = 'requests' | 'offers' | 'archived';

export interface MyListingSets {
  activeRequests: UIRequest[];
  activeOffers: UIOffer[];
  archivedRequests: UIRequest[];
  archivedOffers: UIOffer[];
}

export interface MyListing {
  kind: ListingType;
  listing: UIRequest | UIOffer;
  archived: boolean;
}

const lastTouched = (l: UIRequest | UIOffer) => l.updated_at ?? l.created_at ?? 0;

const newestFirst = (a: MyListing, b: MyListing) => lastTouched(b.listing) - lastTouched(a.listing);

const as = (kind: ListingType, archived: boolean) => (listing: UIRequest | UIOffer) => ({
  kind,
  listing,
  archived
});

export function listingsFor(view: ListingView, sets: MyListingSets): MyListing[] {
  switch (view) {
    case 'requests':
      return sets.activeRequests.map(as('Request', false)).sort(newestFirst);
    case 'offers':
      return sets.activeOffers.map(as('Offer', false)).sort(newestFirst);
    case 'archived':
      return [
        ...sets.archivedRequests.map(as('Request', true)),
        ...sets.archivedOffers.map(as('Offer', true))
      ].sort(newestFirst);
  }
}

export function listingCounts(sets: MyListingSets): Record<ListingView, number> {
  return {
    requests: sets.activeRequests.length,
    offers: sets.activeOffers.length,
    archived: sets.archivedRequests.length + sets.archivedOffers.length
  };
}
