import type { ListingType } from '$lib/types/holochain';
import type { UIOffer, UIRequest } from '$lib/types/ui';

/**
 * My Listings (#344): the three views the count cards choose between, and the
 * listings each one shows. Archived holds both kinds together.
 */

export type ListingView = 'requests' | 'offers' | 'archived';

/** The view a link asks for with `?view=`; anything else opens Requests. */
export function viewFromQuery(asked: string | null): ListingView {
  return asked === 'offers' || asked === 'archived' ? asked : 'requests';
}

/**
 * The view My Listings opens on: **the one a link asks for, else the one you last had**,
 * else Requests. The profile's doorways ask for one; the menu link asks for none, so it
 * comes back to where you were rather than to Requests (Sam, 18 November).
 */
export function openingView(asked: string | null, remembered: string | null): ListingView {
  // A view the app does not know counts as none asked for, not as Requests.
  const known = (v: string | null) => viewFromQuery(v) === v;
  return viewFromQuery(known(asked) ? asked : remembered);
}

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
