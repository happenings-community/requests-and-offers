import { describe, it, expect } from 'vitest';
import { encode } from '@msgpack/msgpack';
import { isListingOfType, listingTypeOf } from '$lib/utils/listing-record';

/** A record shaped as the conductor returns one, carrying the given entry. */
const recordOf = (entry: Record<string, unknown>) =>
  ({
    signed_action: { hashed: { hash: new Uint8Array(39), content: { timestamp: 0 } } },
    entry: { Present: { entry_type: 'App', entry: encode(entry) } }
  }) as never;

const OFFER = {
  title: 'Holochain mentoring',
  description: 'Three hours of pairing on zome architecture.',
  interaction_type: 'Virtual',
  time_preference: 'Morning',
  links: []
};
// A request carries interaction_type too (integrity `request.rs:35`, no serde default), so
// a fixture without it is a record the zome never writes. The e2e requests journey went
// red on exactly that: every real request was refused as "not a request".
const REQUEST = {
  title: 'Looking for a mentor',
  description: 'Backend development, a few hours a week.',
  contact_preference: 'Email',
  interaction_type: 'InPerson',
  time_preference: 'Morning',
  links: []
};

describe('a read by hash refuses a record of the wrong entry type', () => {
  /**
   * **This is the bug that wrote wrong data.** `get_latest_offer_record` is a bare `get`,
   * so handing it a request's hash returns the request's record, and the decode that
   * follows is plain msgpack with no schema behind it. Every shared card said Offer, and
   * Show interest from one **stored** the Interest with `listing_type: 'Offer'` for a
   * request; the propose page then read that request as an offer, with no terms and offer
   * labels throughout.
   *
   * The discriminator is each entry's own required field. Neither has a serde default, so
   * a record of the other kind cannot carry it.
   *
   * **To make this go red:** return `true` from `isListingOfType` whenever the record
   * decodes. A request passes as an offer again, which is exactly what happened.
   */
  it('a request is not an offer', () => {
    expect(isListingOfType(recordOf(REQUEST), 'Offer')).toBe(false);
    expect(isListingOfType(recordOf(REQUEST), 'Request')).toBe(true);
  });

  /**
   * The field the two entries share cannot tell them apart. Only `contact_preference`
   * does: a request has it (`request.rs:22`), an offer has no such field (`offer.rs`).
   */
  it('a request as the zome writes it, carrying interaction_type, is still a request', () => {
    expect(isListingOfType(recordOf(REQUEST), 'Request')).toBe(true);
    expect(listingTypeOf(recordOf(REQUEST))).toBe('Request');
  });

  it('an offer is not a request', () => {
    expect(isListingOfType(recordOf(OFFER), 'Request')).toBe(false);
    expect(isListingOfType(recordOf(OFFER), 'Offer')).toBe(true);
  });

  /** Both fields are tested, so something carrying neither is refused by both. */
  it('a record that is neither is refused by both', () => {
    const neither = recordOf({ title: 'x', description: 'y' });
    expect(isListingOfType(neither, 'Offer')).toBe(false);
    expect(isListingOfType(neither, 'Request')).toBe(false);
    expect(listingTypeOf(neither)).toBeNull();
  });

  it('something undecodable is refused rather than thrown', () => {
    const broken = {
      signed_action: { hashed: { hash: new Uint8Array(39), content: { timestamp: 0 } } },
      entry: { Present: { entry_type: 'App', entry: new Uint8Array([0xc1]) } }
    } as never;
    expect(() => isListingOfType(broken, 'Offer')).not.toThrow();
    expect(isListingOfType(broken, 'Offer')).toBe(false);
  });

  it('names the type from the record, which is what the card now asks for', () => {
    expect(listingTypeOf(recordOf(OFFER))).toBe('Offer');
    expect(listingTypeOf(recordOf(REQUEST))).toBe('Request');
  });
});
