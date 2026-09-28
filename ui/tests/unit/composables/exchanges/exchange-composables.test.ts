import { describe, it, expect } from 'vitest';

import {
  applyExchangeFilters,
  lastActivity,
  tabToOpen,
  EXCHANGE_TAB_ORDER
} from '$lib/composables/domain/exchanges/useExchangesManagement.svelte';
import {
  counterProposalHref,
  validateReview
} from '$lib/composables/domain/exchanges/useExchangeDetails.svelte';
import { proposeHref } from '$lib/composables/domain/exchanges/useListingInterest.svelte';
import type { UIExchange, UIInterest } from '$lib/types/ui';

const hash = (n: number) => new Uint8Array([n, n, n, n]);

const me = hash(3);
const them = hash(4);

/**
 * An exchange as the store decodes it. The agreement names its `counterparty`:
 * the party who did NOT write it up and therefore owes the answer. The default
 * here is a proposal I sent, so the move is theirs.
 */
const exchange = (over: Partial<UIExchange> = {}, agreementOver = {}): UIExchange =>
  ({
    created_at: 1_700_000_000_000,
    agreement_hash: hash(10),
    agreement: {
      listing: hash(1),
      listing_type: 'Offer',
      interest: hash(2),
      counterparty: them,
      provider: me,
      receiver: them,
      primary: {
        direction: 'Provide',
        resource_conforms_to: 'Gardening',
        resource_kind: 'Service',
        quantity: null
      },
      reciprocal: {
        direction: 'Receive',
        resource_conforms_to: '',
        resource_kind: 'Gift',
        quantity: null
      },
      medium: 'Free/Pay it Forward',
      terms: '',
      delivery_timeframe: 'Within 2 weeks',
      ...agreementOver
    },
    status: 'Proposed',
    ...over
  }) as UIExchange;

describe('lastActivity', () => {
  it('is the agreement time when nothing has been written against it', () => {
    expect(lastActivity(exchange())).toBe(1_700_000_000_000);
  });

  it('is the newest entry once the exchange has moved', () => {
    const moved = exchange({
      status: 'Agreed',
      response: { agreement: hash(10), accepted: true, note: '', created_at: 1_700_000_500_000 },
      provider_done: { created_at: 1_700_000_900_000 }
    } as Partial<UIExchange>);
    expect(lastActivity(moved)).toBe(1_700_000_900_000);
  });
});

describe('tabToOpen', () => {
  it('opens the first tab holding something waiting on me', () => {
    // A proposal sent TO me names me as the counterparty: my move, and a
    // proposal lives under proposals.
    const sentToMe = exchange({}, { counterparty: me });
    expect(tabToOpen([sentToMe], me, 'active')).toBe('proposals');
  });

  it('keeps the fallback when nothing is waiting on me', () => {
    // A proposal I sent is waiting on them, not on me.
    expect(tabToOpen([exchange()], me, 'active')).toBe('active');
  });

  it('reads the tabs in the order the page shows them', () => {
    expect([...EXCHANGE_TAB_ORDER]).toEqual(['proposals', 'active', 'completed']);
  });
});

describe('applyExchangeFilters', () => {
  const base = {
    tab: 'proposals' as const,
    side: 'all' as const,
    origin: 'all' as const,
    turn: 'all' as const,
    order: 'latest' as const
  };

  it('keeps only the tab asked for', () => {
    const agreed = exchange({
      status: 'Agreed',
      response: { agreement: hash(10), accepted: true, note: '', created_at: 1 }
    } as Partial<UIExchange>);
    expect(applyExchangeFilters([exchange(), agreed], me, base)).toHaveLength(1);
    expect(applyExchangeFilters([exchange(), agreed], me, { ...base, tab: 'active' })).toHaveLength(
      1
    );
  });

  it('filters by the side I am on', () => {
    const asReceiver = exchange({}, { provider: them, receiver: me });
    const list = [exchange(), asReceiver];
    expect(applyExchangeFilters(list, me, { ...base, side: 'provider' })).toHaveLength(1);
    expect(applyExchangeFilters(list, me, { ...base, side: 'receiver' })).toHaveLength(1);
  });

  it('filters by where the exchange started', () => {
    const fromRequest = exchange({}, { listing_type: 'Request' });
    const list = [exchange(), fromRequest];
    expect(applyExchangeFilters(list, me, { ...base, origin: 'Request' })).toHaveLength(1);
    expect(applyExchangeFilters(list, me, { ...base, origin: 'Offer' })).toHaveLength(1);
  });

  it('filters by whose move it is', () => {
    const sentByMe = exchange();
    const sentToMe = exchange({}, { counterparty: me });
    const list = [sentByMe, sentToMe];
    expect(applyExchangeFilters(list, me, { ...base, turn: 'you' })).toEqual([sentToMe]);
    expect(applyExchangeFilters(list, me, { ...base, turn: 'them' })).toEqual([sentByMe]);
  });

  it('orders by last activity, newest first by default', () => {
    const older = exchange({ created_at: 1_600_000_000_000, agreement_hash: hash(11) });
    const [first] = applyExchangeFilters([older, exchange()], me, base);
    expect(first.agreement_hash).toEqual(hash(10));
    const [oldestFirst] = applyExchangeFilters([older, exchange()], me, {
      ...base,
      order: 'oldest'
    });
    expect(oldestFirst.agreement_hash).toEqual(hash(11));
  });

  it('puts a withdrawn proposal with the proposals, not the active ones', () => {
    const withdrawn = exchange({ status: 'Cancelled' });
    expect(applyExchangeFilters([withdrawn], me, base)).toHaveLength(1);
    expect(applyExchangeFilters([withdrawn], me, { ...base, tab: 'active' })).toHaveLength(0);
  });
});

describe('validateReview', () => {
  it('passes a rating the zome would accept', () => {
    expect(validateReview({ rating: 3, on_time: true, as_agreed: true, comment: '' })).toBeNull();
  });

  it('names the problem with an unrated review', () => {
    expect(validateReview({ rating: 0, on_time: false, as_agreed: false, comment: '' })).toContain(
      'one to five stars'
    );
  });

  it('names the problem with a rating above five', () => {
    expect(validateReview({ rating: 9, on_time: false, as_agreed: false, comment: '' })).toContain(
      'one to five stars'
    );
  });
});

describe('proposal links', () => {
  it('carries the interest, the listing and its type into the counter-proposal', () => {
    const href = counterProposalHref(exchange());
    expect(href).toContain('/exchanges/propose?interest=');
    expect(href).toContain('&type=Offer');
  });

  it('builds the same link from an interest on a listing', () => {
    const interest = {
      interest_hash: hash(20),
      listing: hash(1),
      listing_type: 'Request',
      user: me,
      created_at: 1
    } as UIInterest;
    const href = proposeHref(interest, hash(1), 'Request');
    expect(href).toContain('/exchanges/propose?interest=');
    expect(href).toContain('&type=Request');
  });
});
