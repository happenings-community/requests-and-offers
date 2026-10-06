import { describe, it, expect } from 'vitest';
import { encodeHashToBase64 } from '@holochain/client';
import type { ExchangeStatus } from '$lib/types/holochain';
import {
  paths,
  readOrigin,
  createListingFrom,
  routeAfterPublish,
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
   * **To make this go red:** return `conversation` whenever `from` is set. The proposal
   * arrival collapses into the conversation one and "Continue your proposal" disappears.
   */
  it('tells the two conversation arrivals apart by the context they carry', () => {
    expect(readOrigin(url(createListingFrom('Offer', PROPOSAL))).kind).toBe('proposal');
    expect(readOrigin(url(createListingFrom('Offer', CONVERSATION))).kind).toBe('conversation');
  });

  it('no conversation means no origin, whatever else is in the URL', () => {
    expect(readOrigin(url('/offers/create')).kind).toBe('none');
    expect(
      readOrigin(url(`/offers/create?listing=${b64(LISTING)}&type=Offer`)).kind,
      'context without a counterparty is not an origin'
    ).toBe('none');
  });

  it('a half-carried proposal is a conversation, not a broken proposal', () => {
    // `type` missing: resuming would have nothing to look the listing up with.
    expect(readOrigin(url(`/offers/create?from=${b64(ANITA)}&listing=${b64(LISTING)}`)).kind).toBe(
      'conversation'
    );
  });

  it('round-trips the proposal context it carries', () => {
    const read = readOrigin(url(createListingFrom('Request', PROPOSAL)));
    expect(read.kind === 'proposal' && b64(read.listing)).toBe(b64(LISTING));
    expect(read.kind === 'proposal' && b64(read.interest)).toBe(b64(INTEREST));
    expect(read.kind === 'proposal' && read.type).toBe('Request');
  });
});

describe('routeAfterPublish: what is offered once a listing is published', () => {
  it.each([
    ['from the propose page', PROPOSAL, 'continueProposal'],
    ['from the picker', CONVERSATION, 'shareWith'],
    ['from the ordinary create page', { kind: 'none' } as Origin, 'none']
  ])('%s', (_name, origin, expected) => {
    expect(routeAfterPublish(origin).kind).toBe(expected);
  });

  /** Resuming lands back on the proposal, with everything it needs to rebuild itself. */
  it('continuing a proposal returns to it with its own context', () => {
    const after = routeAfterPublish(PROPOSAL);
    expect(after.kind).toBe('continueProposal');
    const q = url(after.kind === 'continueProposal' ? after.href : '').searchParams;
    expect(q.get('listing')).toBe(b64(LISTING));
    expect(q.get('type')).toBe('Request');
    expect(q.get('interest')).toBe(b64(INTEREST));
    expect(q.get('from')).toBe(b64(ANITA));
  });

  /** Sharing is offered, never done. Publishing and telling someone are two decisions. */
  it('sharing offers the conversation rather than navigating to it', () => {
    const after = routeAfterPublish(CONVERSATION);
    expect(after.kind === 'shareWith' && after.conversation).toBe(paths.conversation(ANITA));
  });
});

describe('routeAfter: where an exchange goes once something happens to it', () => {
  const LIVE: ExchangeStatus[] = ['Proposed', 'Agreed', 'OneSideDone', 'Complete'];
  const TERMINAL: ExchangeStatus[] = ['Declined', 'Cancelled', 'Reviewed'];

  /**
   * **A proposal sent from a conversation belongs in that conversation.** Landing on a
   * proposal detail page instead strands the member away from the thread they were in.
   *
   * **To make this go red:** always return the exchange detail. Every row below flips.
   */
  it.each(LIVE)('%s, started from a conversation, returns to it', (status) => {
    expect(routeAfter({ status, exchange: EXCHANGE, from: ANITA })).toBe(
      paths.conversation(ANITA)
    );
  });

  it.each(LIVE)('%s, reached any other way, goes to its own page', (status) => {
    expect(routeAfter({ status, exchange: EXCHANGE, from: null })).toBe(
      paths.exchangeDetail(EXCHANGE)
    );
  });

  /**
   * A terminal exchange has nothing further to do, so it goes to its own page even from a
   * conversation: that is where the reason is readable. Returning to a thread showing a
   * card with no actions says less.
   */
  it.each(TERMINAL)('%s goes to its own page even from a conversation', (status) => {
    const href = routeAfter({ status, exchange: EXCHANGE, from: ANITA });
    expect(href.startsWith(`/exchanges/${b64(EXCHANGE)}`)).toBe(true);
    expect(
      url(href).searchParams.get('from'),
      'and still knows the way back'
    ).toBe(b64(ANITA));
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
