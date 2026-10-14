import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { encodeHashToBase64 } from '@holochain/client';
import { proposeHrefFor } from '$lib/utils/messaging-threads';
import {
  paths,
  readOrigin,
  readProposeParams,
  createListingFrom,
  routeAfterPublish,
  readReciprocal,
  routeAfter,
  routeBack,
  type Origin
} from '$lib/paths';

const hash = (n: number) => new Uint8Array(Array(39).fill(n));
const ANITA = hash(3);
const LISTING = hash(1);
const INTEREST = hash(2);
const EXCHANGE = hash(9);
const url = (built: string) => new URL(built, 'http://localhost');
const b64 = encodeHashToBase64;

const CONVERSATION: Origin = { kind: 'conversation', counterparty: ANITA };
const PROPOSAL: Origin = {
  kind: 'proposal',
  counterparty: ANITA,
  listing: LISTING,
  type: 'Request',
  interest: INTEREST
};

describe('readOrigin: which arrival this was', () => {
  /**
   * **The picker's "New offer" and the propose page's "Post an offer" built the identical
   * URL**, so the create page could not tell them apart, and they want different endings:
   * one shares the listing into the conversation, the other resumes the proposal with it.
   *
   * **A marker says which, rather than the details implying it.** Reading the proposal's
   * details as the signal worked, but any link that happened to carry them was read as a
   * proposal arrival whether or not it was one.
   *
   * **To make this go red:** drop the `return=proposal` check from `readOrigin`. The
   * marked and unmarked URLs below both read as a proposal, and the first assertion of
   * the next test fails.
   */
  it('reads the marker, which only one builder writes', () => {
    expect(readOrigin(url(createListingFrom('Offer', PROPOSAL))).kind).toBe('proposal');
    expect(readOrigin(url(createListingFrom('Offer', CONVERSATION))).kind).toBe('conversation');
  });

  it('the details alone are not a signal', () => {
    // Everything a proposal arrival carries, except the marker that says it is one.
    const unmarked =
      `/offers/create?from=${b64(ANITA)}&listing=${b64(LISTING)}` +
      `&type=Request&interest=${b64(INTEREST)}`;
    expect(readOrigin(url(unmarked)).kind, 'no marker, no proposal').toBe('conversation');
  });

  /**
   * A marker whose details are missing is a return that cannot be made, so it falls back
   * to the conversation rather than producing a proposal that cannot be rebuilt.
   */
  it('a marker without the details is the conversation arrival', () => {
    const partial = `/offers/create?from=${b64(ANITA)}&return=proposal&listing=${b64(LISTING)}`;
    expect(readOrigin(url(partial)).kind).toBe('conversation');
    const bare = `/offers/create?from=${b64(ANITA)}&return=proposal`;
    expect(readOrigin(url(bare)).kind).toBe('conversation');
  });

  it('no conversation means no origin, whatever else is in the URL', () => {
    expect(readOrigin(url('/offers/create')).kind).toBe('none');
    expect(
      readOrigin(url(`/offers/create?return=proposal&listing=${b64(LISTING)}&type=Offer`)).kind,
      'context and marker without a counterparty is not an origin'
    ).toBe('none');
  });

  it('round-trips the proposal context it carries', () => {
    const read = readOrigin(url(createListingFrom('Request', PROPOSAL)));
    expect(read.kind === 'proposal' && b64(read.listing)).toBe(b64(LISTING));
    expect(read.kind === 'proposal' && b64(read.interest)).toBe(b64(INTEREST));
    expect(read.kind === 'proposal' && read.type).toBe('Request');
  });
});

describe('routeAfterPublish: what is offered once a listing is published', () => {
  const PUBLISHED = hash(7);

  it.each([
    ['from the propose page', PROPOSAL, 'continueProposal'],
    ['from the picker', CONVERSATION, 'shareWith'],
    ['from the ordinary create page', { kind: 'none' } as Origin, 'none']
  ])('%s', (_name, origin, expected) => {
    expect(routeAfterPublish(origin, PUBLISHED).kind).toBe(expected);
  });

  /**
   * **Continuing a proposal has to carry the new listing.** By the time the member is back
   * on the propose page it is one of several they may have published, and nothing there
   * could pick it out.
   *
   * **To make this go red:** drop `reciprocal` from the href `routeAfterPublish` builds.
   * The hash is no longer in the address and `readReciprocal` has nothing to return.
   */
  it('carries the new listing back, as well as the proposal it belongs to', () => {
    const after = routeAfterPublish(PROPOSAL, PUBLISHED);
    expect(after.kind).toBe('continueProposal');
    const built = url(after.kind === 'continueProposal' ? after.href : '');
    expect(built.searchParams.get('listing')).toBe(b64(LISTING));
    expect(built.searchParams.get('type')).toBe('Request');
    expect(built.searchParams.get('interest')).toBe(b64(INTEREST));
    expect(built.searchParams.get('from')).toBe(b64(ANITA));
    expect(built.searchParams.get('reciprocal'), 'the listing just published').toBe(b64(PUBLISHED));
  });

  /** The propose page reads it back through the module, not by hand. */
  it('and the propose page reads that listing back', () => {
    const after = routeAfterPublish(PROPOSAL, PUBLISHED);
    const read = readReciprocal(url(after.kind === 'continueProposal' ? after.href : ''));
    expect(read && b64(read)).toBe(b64(PUBLISHED));
  });

  /** Publishing can fail to hand back a hash; the member still gets their way on. */
  it('still continues when the published listing is unknown', () => {
    const after = routeAfterPublish(PROPOSAL, null);
    expect(after.kind).toBe('continueProposal');
    const built = url(after.kind === 'continueProposal' ? after.href : '');
    expect(built.searchParams.has('reciprocal'), 'nothing to preselect').toBe(false);
    expect(built.searchParams.get('listing'), 'the proposal is still rebuildable').toBe(
      b64(LISTING)
    );
  });

  /** Sharing is offered, never done. Publishing and telling someone are two decisions. */
  it('sharing offers the conversation rather than navigating to it', () => {
    const after = routeAfterPublish(CONVERSATION, PUBLISHED);
    expect(after.kind === 'shareWith' && after.conversation).toBe(paths.conversation(ANITA));
  });
});

describe('routeAfter: from a conversation, stay in it', () => {
  /**
   * **Sam, 6 October: a conversation does not end because one proposal did.** Declining is
   * often the moment another proposal gets made, and being thrown onto a detail page to
   * read a reason is what stops that happening. So every action taken from a conversation
   * leaves the member in it, with the card updated in place, whatever the exchange now is.
   *
   * This used to depend on the status, with terminal exchanges going to the detail page.
   * That split one rule across seven cases and sent people away at the point they most
   * needed to be there.
   *
   * **To make this go red:** return the exchange detail when the status is terminal. Every
   * action below that ends in one fails.
   */
  it.each(['send', 'accept', 'decline', 'withdraw', 'cancel'])(
    '%s, done from a conversation, leaves the member in it',
    () => {
      expect(routeAfter({ exchange: EXCHANGE, from: ANITA })).toBe(paths.conversation(ANITA));
    }
  );

  it('reached any other way, the exchange page stays put', () => {
    expect(routeAfter({ exchange: EXCHANGE, from: null })).toBe(paths.exchangeDetail(EXCHANGE));
  });

  /** Where a member goes does not depend on status, so no status is asked for. */
  it('takes no status at all', () => {
    expect(routeAfter.length, 'one argument, and no status in it').toBe(1);
  });
});

describe('routeBack: the Back link and its wording', () => {
  it.each([
    ['a conversation', CONVERSATION, 'conversation'],
    ['a proposal started in one', PROPOSAL, 'conversation'],
    ['nowhere in particular', { kind: 'none' } as Origin, 'default']
  ])('reached from %s', (_name, origin, wording) => {
    expect(routeBack(origin, paths.exchanges()).wording).toBe(wording);
  });

  it('points at the conversation, and names whose it is', () => {
    const back = routeBack(CONVERSATION, paths.exchanges());
    expect(back.href).toBe(paths.conversation(ANITA));
    expect(back.wording === 'conversation' && b64(back.counterparty)).toBe(b64(ANITA));
  });

  it('keeps the page’s own Back when there is no conversation', () => {
    expect(routeBack({ kind: 'none' }, paths.exchanges()).href).toBe('/exchanges');
  });
});

/**
 * **Wherever an exchange appears, there is a way to the chat it belongs to** (Sam,
 * 6 October). Opened from My Exchanges the page offers both; opened from a conversation,
 * Back already goes there and a second link to the same place would be noise.
 *
 * Source-reading, as the project has no component-mounting setup; what it checks is that
 * the chat link is behind the no-origin branch and the Back link is not.
 */
describe('the exchange page offers the chat when it was not reached from one', () => {
  const SOURCE = 'src/routes/(public)/exchanges/[id]/+page.svelte';
  const source = readFileSync(SOURCE, 'utf8');

  /**
   * **H4 moved the link, not the claim.** The page no longer builds a chat address: it
   * renders `ReachPerson`, which shows whatever messaging plugged in, or Contact on a
   * network without messaging. So the guard is asserted here and the address itself is
   * asserted in the component that now owns it, below.
   */
  it('offers a way to reach the other person only when Back does not already go there', () => {
    const at = source.indexOf('<ReachPerson');
    expect(at, 'the component is rendered').toBeGreaterThan(-1);
    const guard = [...source.slice(0, at).matchAll(/\{#if ([^}]+)\}/g)].pop()?.[1] ?? '';
    expect(guard).toContain("back.wording !== 'conversation'");
  });

  it('hands it the other party, and builds no messaging address itself', () => {
    const at = source.indexOf('<ReachPerson');
    const near = source.slice(at, at + 200);
    expect(near).toContain('person={counterpartyOf(exchange, me)}');
    expect(source, 'the page knows who, not how').not.toContain('paths.conversation(');
  });

  it('and the component messaging supplies is what addresses the conversation', () => {
    const chat = readFileSync('src/lib/components/messaging/GoToChat.svelte', 'utf8');
    expect(chat).toContain('data-testid="go-to-chat"');
    expect(chat).toContain('paths.conversation(person)');
  });

  it('Back is always there, and carries the paired wording', () => {
    expect(source).toContain('routeBack(readOrigin(page.url), paths.exchanges())');
    expect(source).toContain("back.wording === 'conversation'");
    expect(source).toContain('S.listing.backToConversation');
  });
});

/**
 * **Finding 14: a proposal started in the chat must land back in the chat.**
 *
 * The whole chain, not just one link in it: the picker builds the address, the propose
 * page reads it, and `routeAfter` decides where sending lands. Testing only the builder
 * would have passed while the page threw the value away, and testing only `routeAfter`
 * would have passed while the address never carried it.
 *
 * **To make this go red:** drop `from` from `proposeHrefFor`. The address no longer
 * carries the conversation, the page reads `null`, and sending lands on the exchange page
 * with "Back to exchanges" — which is exactly what Sam saw.
 */
describe('a proposal started from the chat picker lands back in the chat', () => {
  const INTEREST = {
    interest_hash: hash(2),
    listing: hash(1),
    listing_type: 'Request'
  };

  it('end to end, from the picker to where sending goes', () => {
    // 1. The picker builds the link, knowing the conversation it sits in.
    const href = proposeHrefFor(INTEREST, ANITA);

    // 2. The propose page reads it back through the module.
    const read = readProposeParams(url(href));
    expect(read.from && b64(read.from), 'the conversation survives the address').toBe(b64(ANITA));
    expect(read.type, 'and so does the listing type').toBe('Request');

    // 3. Sending lands where the arrival says.
    expect(routeAfter({ exchange: EXCHANGE, from: read.from })).toBe(paths.conversation(ANITA));
  });

  it('and from a listing page, which has no conversation, it does not pretend to', () => {
    const read = readProposeParams(
      url(paths.exchangePropose({ listing: hash(1), type: 'Request', interest: hash(2) }))
    );
    expect(read.from).toBeNull();
    expect(routeAfter({ exchange: EXCHANGE, from: read.from })).toBe(
      paths.exchangeDetail(EXCHANGE)
    );
  });
});
