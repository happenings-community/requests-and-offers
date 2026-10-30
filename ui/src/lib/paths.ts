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
  serviceType: 'service_type',
  /**
   * Which flow sent the member here.
   *
   * **Written only by the propose page's "Post an offer".** The picker's New offer and
   * that link used to build the identical URL, and reading the proposal's details as a
   * signal worked but made the meaning implicit: a link that happened to carry them was
   * read as a proposal arrival whether or not it was one. A marker says it outright.
   */
  return: 'return',
  /**
   * A listing published mid-proposal, to be preselected as the other side on return.
   *
   * It cannot be inferred: by the time the member is back on the propose page, their new
   * offer is one of several they may have.
   */
  reciprocal: 'reciprocal'
} as const;

/** The only value `return` takes. More flows would add more. */
const RETURN_PROPOSAL = 'proposal';

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
export function readHash(raw: string | null): ActionHash | null {
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

/**
 * What a create page may be told.
 *
 * `returnTo` and the proposal's own context travel together: the marker says the member
 * came from a proposal, and the rest is what rebuilding it needs. Typed here rather than
 * appended as a query string by hand, so a key cannot be spelled twice.
 */
export type CreateListingOptions = {
  from?: IdLike;
  organization?: IdLike;
  returnTo?: 'proposal';
  listing?: IdLike;
  listingType?: ListingType;
  interest?: IdLike;
};

function createListingQuery(opts: CreateListingOptions): string {
  return query({
    [P.from]: opts.from && h(opts.from),
    [P.organization]: opts.organization && h(opts.organization),
    [P.return]: opts.returnTo,
    [P.listing]: opts.listing && h(opts.listing),
    [P.type]: opts.listingType,
    [P.interest]: opts.interest && h(opts.interest)
  });
}

export const paths = {
  home: () => '/',

  // Listings
  requests: (opts: { filter?: string; serviceType?: string } = {}) =>
    `/requests${query({ [P.filter]: opts.filter, [P.serviceType]: opts.serviceType })}`,
  requestDetail: (id: IdLike) => `/requests/${h(id)}`,
  requestEdit: (id: IdLike) => `/requests/${h(id)}/edit`,
  requestCreate: (opts: CreateListingOptions = {}) => `/requests/create${createListingQuery(opts)}`,

  offers: (opts: { filter?: string; serviceType?: string } = {}) =>
    `/offers${query({ [P.filter]: opts.filter, [P.serviceType]: opts.serviceType })}`,
  offerDetail: (id: IdLike) => `/offers/${h(id)}`,
  offerEdit: (id: IdLike) => `/offers/${h(id)}/edit`,
  offerCreate: (opts: CreateListingOptions = {}) => `/offers/create${createListingQuery(opts)}`,

  /** A listing of either kind, for the places that hold the type as data. */
  listingDetail: (id: IdLike, type: ListingType) =>
    type === 'Offer' ? `/offers/${h(id)}` : `/requests/${h(id)}`,
  listingCreate: (type: ListingType, opts: CreateListingOptions = {}) =>
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
    /** A listing published mid-proposal, to preselect as the other side. */
    reciprocal?: IdLike;
  }) =>
    `/exchanges/propose${query({
      [P.interest]: h(args.interest),
      [P.listing]: h(args.listing),
      [P.type]: args.type,
      [P.from]: args.from && h(args.from),
      [P.reciprocal]: args.reciprocal && h(args.reciprocal)
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

// ---------------------------------------------------------------------------
// Where next, and where back
// ---------------------------------------------------------------------------

/**
 * Where a flow was started, which decides where it returns to.
 *
 * **`from` alone cannot tell the two conversation arrivals apart.** The picker's "New
 * offer" and the propose page's "Post an offer" both carry the same counterparty, so both
 * produced the identical URL `/offers/create?from=<user>`, and the create page had no way
 * to know which it was. They want different endings: one shares the new listing into the
 * conversation, the other resumes the proposal with it as the reciprocal side.
 *
 * **A marker says which, rather than the details implying it.** `return=proposal` is
 * written by one link and read here. Inferring it from the proposal's details worked, but
 * meant any link that happened to carry them was read as a proposal arrival whether or not
 * it was one. The details still have to be there to rebuild the proposal, so a marker
 * without them is the conversation arrival: a return that cannot be made is not one.
 */
export type Origin =
  | { kind: 'none' }
  | { kind: 'conversation'; counterparty: ActionHash }
  | {
      kind: 'proposal';
      counterparty: ActionHash;
      listing: ActionHash;
      type: ListingType;
      interest: ActionHash;
    };

/** Read the origin from any page's URL. */
export function readOrigin(url: URL): Origin {
  const { from, listing, type, interest } = readProposeParams(url);
  if (!from) return { kind: 'none' };
  const marked = url.searchParams.get(P.return) === RETURN_PROPOSAL;
  if (marked && listing && type && interest) {
    return { kind: 'proposal', counterparty: from, listing, type, interest };
  }
  return { kind: 'conversation', counterparty: from };
}

/** The listing to preselect as the other side, when a proposal is resumed. */
export function readReciprocal(url: URL): ActionHash | null {
  return readHash(url.searchParams.get(P.reciprocal));
}

/**
 * The create page a listing is published from, carrying enough to get back.
 *
 * From the picker, that is the conversation. From the propose page, it is the proposal:
 * the marker says which, and the context travels so the proposal can be rebuilt.
 */
export function createListingFrom(type: ListingType, origin: Origin): string {
  if (origin.kind === 'proposal') {
    return paths.listingCreate(type, {
      from: origin.counterparty,
      returnTo: 'proposal',
      listing: origin.listing,
      listingType: origin.type,
      interest: origin.interest
    });
  }
  if (origin.kind === 'conversation') {
    return paths.listingCreate(type, { from: origin.counterparty });
  }
  return paths.listingCreate(type);
}

/**
 * What a member is offered once a listing is published, and where it leads.
 *
 * Three endings, because there are three ways in. Nothing is ever shared automatically:
 * publishing a listing and telling somebody about it are two decisions.
 */
export type AfterPublish =
  | { kind: 'continueProposal'; href: string }
  | { kind: 'shareWith'; counterparty: ActionHash; conversation: string }
  | { kind: 'none' };

export function routeAfterPublish(origin: Origin, published: ActionHash | null): AfterPublish {
  if (origin.kind === 'proposal') {
    return {
      kind: 'continueProposal',
      // The new listing travels back, because by the time the member is on the propose
      // page again it is one of several they may have, and nothing there could pick it out.
      href: paths.exchangePropose({
        listing: origin.listing,
        type: origin.type,
        interest: origin.interest,
        from: origin.counterparty,
        reciprocal: published ?? undefined
      })
    };
  }
  if (origin.kind === 'conversation') {
    return {
      kind: 'shareWith',
      counterparty: origin.counterparty,
      conversation: paths.conversation(origin.counterparty)
    };
  }
  return { kind: 'none' };
}

/**
 * Where to go once something has been done to an exchange.
 *
 * **From a conversation, stay in it** (Sam, 6 October). Sending, accepting, declining,
 * withdrawing and cancelling all leave the member where they were, with the card updated
 * in place, whatever the exchange now is. A conversation does not end because one proposal
 * did: declining is often the moment another proposal gets made, and being thrown onto a
 * detail page to read a reason is what stops that happening.
 *
 * Reached any other way, the exchange's own page stays put.
 *
 * **The status is deliberately not a parameter.** It was, with terminal states going to
 * the detail page, which split one simple rule across seven cases and sent people away
 * from the conversation at exactly the point they most needed it. Where status does matter
 * is in what a card says and whose turn it is, and those are exhaustive switches over
 * {@link EXCHANGE_STATUSES} rather than lists repeated here.
 */
export function routeAfter(input: { exchange: IdLike; from: ActionHash | null }): string {
  if (input.from) return paths.conversation(input.from);
  return paths.exchangeDetail(input.exchange);
}

/**
 * The Back link for a page, and which wording it takes.
 *
 * Reached from a conversation, every Back reads "Back to your conversation with {name}";
 * reached any other way, each page keeps the Back it had. The wording key travels with the
 * href so the two cannot disagree.
 */
export type BackLink =
  | { wording: 'conversation'; href: string; counterparty: ActionHash }
  | { wording: 'default'; href: string };

export function routeBack(origin: Origin, fallback: string): BackLink {
  if (origin.kind === 'none') return { wording: 'default', href: fallback };
  return {
    wording: 'conversation',
    href: paths.conversation(origin.counterparty),
    counterparty: origin.counterparty
  };
}
