/**
 * Every internal link in the interface, built in one place.
 *
 * **A parameter name should exist once.** The picker wrote `listingType=` and the propose
 * page read `type=`, so every pick arrived with no type and nothing could be proposed from
 * the picker at all. Both halves were valid TypeScript and neither file could see the
 * other. Here the builder and the parser for a route sit next to each other and share the
 * key through `P`, so a rename that reaches one reaches both, and a test can walk a built
 * URL back to what its destination reads.
 *
 * Ported from the design system's `$lib/paths`, which cannot have that bug for the same
 * reason. Hashes travel as base64 in a query string and in a route segment alike, so the
 * encoding lives here too rather than at each call.
 */
import { encodeHashToBase64, decodeHashFromBase64, type ActionHash } from '@holochain/client';
import type { ListingType } from '$lib/types/holochain';

/** The query keys, named once. Builders write them; parsers read them. */
const P = {
  listing: 'listing',
  type: 'type',
  interest: 'interest',
  /** The conversation a flow was started from, so it can be returned to. */
  from: 'from',
  organization: 'organization',
  filter: 'filter',
  serviceType: 'service_type'
} as const;

/**
 * A record id in a URL.
 *
 * Call sites hold these two ways: as an `ActionHash` from a record, and as the base64
 * string a route parameter already is. Accepting both keeps one builder per destination,
 * which is the point of this module; making them decode first would add a conversion that
 * can itself throw, at every call.
 */
export type IdLike = ActionHash | string;

const h = (id: IdLike): string => (typeof id === 'string' ? id : encodeHashToBase64(id));

/** Drop empty values rather than writing `?from=undefined`. */
function query(parts: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(parts)) {
    if (value !== undefined && value !== '') q.set(key, value);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** A Holochain hash is 39 bytes: 3 of multihash prefix, 32 of digest, 4 of DHT location. */
const HASH_BYTES = 39;

/**
 * A hash from a URL, or `null` if it is not one.
 *
 * **`decodeHashFromBase64` does not throw on rubbish.** It decodes what it can and
 * returns a short array, so the `try`/`catch` this replaces never fired: a malformed
 * link produced a plausible-looking `ActionHash` of the wrong length, and the failure
 * surfaced later as a lookup that found nothing. The length is the check.
 */
function readHash(raw: string | null): ActionHash | null {
  if (!raw) return null;
  try {
    const hash = decodeHashFromBase64(raw);
    return hash.length === HASH_BYTES ? hash : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export const paths = {
  home: () => '/',

  // Listings
  requests: (opts: { filter?: string; serviceType?: string } = {}) =>
    `/requests${query({ [P.filter]: opts.filter, [P.serviceType]: opts.serviceType })}`,
  requestDetail: (id: IdLike) => `/requests/${h(id)}`,
  requestEdit: (id: IdLike) => `/requests/${h(id)}/edit`,
  requestCreate: (opts: { from?: IdLike; organization?: IdLike } = {}) =>
    `/requests/create${query({
      [P.from]: opts.from && h(opts.from),
      [P.organization]: opts.organization && h(opts.organization)
    })}`,

  offers: (opts: { filter?: string; serviceType?: string } = {}) =>
    `/offers${query({ [P.filter]: opts.filter, [P.serviceType]: opts.serviceType })}`,
  offerDetail: (id: IdLike) => `/offers/${h(id)}`,
  offerEdit: (id: IdLike) => `/offers/${h(id)}/edit`,
  offerCreate: (opts: { from?: IdLike; organization?: IdLike } = {}) =>
    `/offers/create${query({
      [P.from]: opts.from && h(opts.from),
      [P.organization]: opts.organization && h(opts.organization)
    })}`,

  /** A listing of either kind, for the places that hold the type as data. */
  listingDetail: (id: IdLike, type: ListingType) =>
    type === 'Offer' ? `/offers/${h(id)}` : `/requests/${h(id)}`,
  listingCreate: (type: ListingType, opts: { from?: IdLike; organization?: IdLike } = {}) =>
    type === 'Offer' ? paths.offerCreate(opts) : paths.requestCreate(opts),

  myListings: () => '/my-listings',

  // Exchanges
  exchanges: () => '/exchanges',
  exchangeDetail: (id: IdLike, opts: { from?: IdLike } = {}) =>
    `/exchanges/${h(id)}${query({ [P.from]: opts.from && h(opts.from) })}`,
  /**
   * The propose page.
   *
   * `listing` and `type` together are what finds the listing, since the page chooses
   * `getOffer` or `getRequest` from the type; `interest` is the record that makes the
   * listing proposable. All three are required because the page cannot open without them.
   */
  exchangePropose: (args: {
    listing: IdLike;
    type: ListingType;
    interest: IdLike;
    from?: IdLike;
  }) =>
    `/exchanges/propose${query({
      [P.interest]: h(args.interest),
      [P.listing]: h(args.listing),
      [P.type]: args.type,
      [P.from]: args.from && h(args.from)
    })}`,

  // Messaging
  messages: (opts: { filter?: string } = {}) => `/messages${query({ [P.filter]: opts.filter })}`,
  conversation: (user: IdLike) => `/messages/${h(user)}`,
  blockedMembers: () => '/messages/blocked',

  // People and organisations
  users: () => '/users',
  userProfile: (id: IdLike) => `/users/${h(id)}`,
  myProfile: () => '/user',
  myProfileCreate: () => '/user/create',
  myProfileEdit: () => '/user/edit',

  organizations: () => '/organizations',
  organizationDetail: (id: IdLike) => `/organizations/${h(id)}`,
  organizationEdit: (id: IdLike) => `/organizations/${h(id)}/edit`,
  organizationCreate: () => '/organizations/create',

  // Service types and tags
  serviceTypes: () => '/service-types',
  serviceTypeDetail: (id: IdLike) => `/service-types/${h(id)}`,
  serviceTypeSuggest: () => '/service-types/suggest',
  tag: (tag: string) => `/tags/${encodeURIComponent(tag)}`,

  // Admin
  admin: () => '/admin',
  adminAdministrators: () => '/admin/administrators',
  adminUsers: () => '/admin/users',
  adminUsersStatusHistory: () => '/admin/users/status-history',
  adminOrganizations: () => '/admin/organizations',
  adminOrganizationsStatusHistory: () => '/admin/organizations/status-history',
  adminRequests: (opts: { serviceType?: string } = {}) =>
    `/admin/requests${query({ [P.serviceType]: opts.serviceType })}`,
  adminOffers: (opts: { serviceType?: string } = {}) =>
    `/admin/offers${query({ [P.serviceType]: opts.serviceType })}`,
  adminServiceTypes: () => '/admin/service-types',
  adminServiceTypeDetail: (id: IdLike) => `/admin/service-types/${h(id)}`,
  adminServiceTypeEdit: (id: IdLike) => `/admin/service-types/${h(id)}/edit`,
  adminServiceTypeCreate: () => '/admin/service-types/create',
  adminServiceTypesModerate: () => '/admin/service-types/moderate',
  adminMediumsOfExchange: () => '/admin/mediums-of-exchange',
  adminMediumOfExchangeEdit: (id: IdLike) => `/admin/mediums-of-exchange/${h(id)}/edit`,
  adminMediumOfExchangeCreate: () => '/admin/mediums-of-exchange/create',
  adminHreaTest: () => '/admin/hrea-test'
} as const;

// ---------------------------------------------------------------------------
// Parsers — one per route that reads parameters, sharing `P` with its builder
// ---------------------------------------------------------------------------

export type ProposeParams = {
  listing: ActionHash | null;
  type: ListingType | null;
  interest: ActionHash | null;
  from: ActionHash | null;
};

/** What the propose page reads. A hash that will not decode comes back as `null`. */
export function readProposeParams(url: URL): ProposeParams {
  const raw = url.searchParams.get(P.type);
  return {
    listing: readHash(url.searchParams.get(P.listing)),
    type: raw === 'Offer' || raw === 'Request' ? (raw as ListingType) : null,
    interest: readHash(url.searchParams.get(P.interest)),
    from: readHash(url.searchParams.get(P.from))
  };
}

export type CreateListingParams = {
  from: ActionHash | null;
  organization: ActionHash | null;
};

/** What the offer and request create pages read. */
export function readCreateListingParams(url: URL): CreateListingParams {
  return {
    from: readHash(url.searchParams.get(P.from)),
    organization: readHash(url.searchParams.get(P.organization))
  };
}

/** The conversation a page was reached from, for the way back. */
export function readFrom(url: URL): ActionHash | null {
  return readHash(url.searchParams.get(P.from));
}

/** The list filter the listing index pages read. */
export function readFilter(url: URL): string | null {
  return url.searchParams.get(P.filter);
}

/** The service type an index page was narrowed to. */
export function readServiceType(url: URL): string | null {
  return url.searchParams.get(P.serviceType);
}
