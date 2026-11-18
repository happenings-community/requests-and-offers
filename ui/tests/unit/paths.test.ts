import { describe, it, expect } from 'vitest';
import { encodeHashToBase64 } from '@holochain/client';
import {
  paths,
  readProposeParams,
  readCreateListingParams,
  readFrom,
  readFilter
} from '$lib/paths';

const hash = (n: number) => new Uint8Array(Array(39).fill(n));
const LISTING = hash(1);
const INTEREST = hash(2);
const USER = hash(3);
const ORG = hash(4);
const url = (built: string) => new URL(built, 'http://localhost');

describe('the propose link, which is where the names drifted apart', () => {
  /**
   * **This is the bug the module exists for.** The picker wrote `listingType=`, the page
   * read `type=`, both were valid TypeScript, and neither file could see the other: no
   * proposal could be started from the picker at all, and the page blamed a missing
   * interest that was there all along.
   *
   * **To make this go red:** rename the `type` key in `P` to `listingType`. The builder
   * and the parser both move, so this assertion on the wire format is what catches it;
   * the round-trip test below would still pass, which is why both exist.
   */
  it('writes exactly the keys the propose page reads', () => {
    const q = url(
      paths.exchangePropose({ listing: LISTING, type: 'Request', interest: INTEREST })
    ).searchParams;
    expect(q.get('type'), 'the page reads `type`').toBe('Request');
    expect(q.get('listing')).toBe(encodeHashToBase64(LISTING));
    expect(q.get('interest')).toBe(encodeHashToBase64(INTEREST));
    expect(q.get('listingType'), 'and never this').toBeNull();
    expect([...q.keys()].sort(), 'no key beyond these three').toEqual([
      'interest',
      'listing',
      'type'
    ]);
  });

  it('carries the conversation only when there is one', () => {
    const without = url(
      paths.exchangePropose({ listing: LISTING, type: 'Offer', interest: INTEREST })
    );
    expect(without.searchParams.has('from'), 'no empty from=').toBe(false);

    const with_ = url(
      paths.exchangePropose({ listing: LISTING, type: 'Offer', interest: INTEREST, from: USER })
    );
    expect(with_.searchParams.get('from')).toBe(encodeHashToBase64(USER));
  });
});

describe('round trip: every builder parses back to what its destination reads', () => {
  /**
   * The test that makes the pairing structural rather than a convention. A builder and
   * the parser for the same route share their keys through `P`, so this walks a built URL
   * back through the parser the destination actually calls.
   *
   * **To make this go red:** have `readProposeParams` read any key the builder does not
   * write. The value comes back `null` and the comparison fails.
   */
  it('the propose page', () => {
    const built = url(
      paths.exchangePropose({
        listing: LISTING,
        type: 'Request',
        interest: INTEREST,
        from: USER
      })
    );
    const read = readProposeParams(built);
    expect(read.listing && encodeHashToBase64(read.listing)).toBe(encodeHashToBase64(LISTING));
    expect(read.interest && encodeHashToBase64(read.interest)).toBe(encodeHashToBase64(INTEREST));
    expect(read.from && encodeHashToBase64(read.from)).toBe(encodeHashToBase64(USER));
    expect(read.type).toBe('Request');
  });

  it.each([
    ['offerCreate', paths.offerCreate({ from: USER, organization: ORG })],
    ['requestCreate', paths.requestCreate({ from: USER, organization: ORG })]
  ])('%s', (_name, built) => {
    const read = readCreateListingParams(url(built));
    expect(read.from && encodeHashToBase64(read.from)).toBe(encodeHashToBase64(USER));
    expect(read.organization && encodeHashToBase64(read.organization)).toBe(
      encodeHashToBase64(ORG)
    );
  });

  it('the exchange detail, whose only parameter is the way back', () => {
    const read = readFrom(url(paths.exchangeDetail(hash(9), { from: USER })));
    expect(read && encodeHashToBase64(read)).toBe(encodeHashToBase64(USER));
  });

  it('the messages list filter', () => {
    expect(readFilter(url(paths.messages({ filter: 'unopened' })))).toBe('unopened');
    expect(readFilter(url(paths.messages()))).toBeNull();
  });

  /** A hash that will not decode is `null`, not a throw: a bad URL is not a crash. */
  it('a malformed hash comes back as nothing', () => {
    const read = readProposeParams(url('/exchanges/propose?listing=not-a-hash&type=Offer'));
    expect(read.listing).toBeNull();
    expect(read.type, 'the readable half still reads').toBe('Offer');
  });

  it('an unknown listing type is not accepted', () => {
    expect(readProposeParams(url('/exchanges/propose?type=Banana')).type).toBeNull();
  });
});

describe('the builders match the route tree', () => {
  /** Each parameterised route, with the id in the segment the route declares. */
  it.each([
    [paths.requestDetail(LISTING), `/requests/${encodeHashToBase64(LISTING)}`],
    [paths.requestEdit(LISTING), `/requests/${encodeHashToBase64(LISTING)}/edit`],
    [paths.offerDetail(LISTING), `/offers/${encodeHashToBase64(LISTING)}`],
    [paths.offerEdit(LISTING), `/offers/${encodeHashToBase64(LISTING)}/edit`],
    [paths.conversation(USER), `/messages/${encodeHashToBase64(USER)}`],
    [paths.userProfile(USER), `/users/${encodeHashToBase64(USER)}`],
    [paths.organizationDetail(ORG), `/organizations/${encodeHashToBase64(ORG)}`],
    [paths.serviceTypeDetail(LISTING), `/service-types/${encodeHashToBase64(LISTING)}`],
    [paths.exchangeDetail(LISTING), `/exchanges/${encodeHashToBase64(LISTING)}`],
    [
      paths.adminServiceTypeEdit(LISTING),
      `/admin/service-types/${encodeHashToBase64(LISTING)}/edit`
    ]
  ])('%s', (built, expected) => {
    expect(built).toBe(expected);
  });

  /** A base64 id from a route parameter and an ActionHash give the same link. */
  it('takes an id either way round', () => {
    expect(paths.offerDetail(encodeHashToBase64(LISTING))).toBe(paths.offerDetail(LISTING));
  });

  it('a listing of either kind goes to its own route', () => {
    expect(paths.listingDetail(LISTING, 'Offer')).toBe(paths.offerDetail(LISTING));
    expect(paths.listingDetail(LISTING, 'Request')).toBe(paths.requestDetail(LISTING));
  });

  it('a tag is escaped, because a tag is free text', () => {
    expect(paths.tag('home & garden')).toBe('/tags/home%20%26%20garden');
  });
});
