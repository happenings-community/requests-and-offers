/**
 * Unit tests for exchange-ui — the pure predicates that decide what My Exchanges
 * tells a member: whose turn it is, which group an exchange belongs to, what the
 * button says. None of this was covered before; turnOf and awaitingMe drive the
 * NavBar pending badge, so a regression here is silent and visible at once.
 *
 * See documentation/architecture/EXCHANGE_RECORD.md for the state model.
 */

import { describe, it, expect } from 'vitest';
import type { ActionHash } from '@holochain/client';
import type { AgreementInDHT, ExchangeStatus, ExchangeTerm } from '$lib/types/holochain';
import type { UIExchange } from '$lib/types/ui';
import {
  EXCHANGE_STATE_LABEL,
  TAB_OF_STATE,
  actionLabel,
  awaitingMe,
  counterpartyOf,
  doneBy,
  exchangeState,
  exchangeStatusVariant,
  formatWhen,
  namedInterest,
  otherRole,
  reciprocalTermFor,
  reviewedBy,
  roleOf,
  statusLabel,
  tabOf,
  termLabel,
  turnOf,
  wroteIt
} from '$lib/utils/exchange-ui';

const ALL_STATUSES: ExchangeStatus[] = [
  'Proposed',
  'Agreed',
  'OneSideDone',
  'Complete',
  'Reviewed',
  'Declined',
  'Cancelled'
];

const hash = (n: number): ActionHash => new Uint8Array([132, 41, 36, n]) as unknown as ActionHash;

const PROVIDER = hash(1);
const RECEIVER = hash(2);
const STRANGER = hash(3);
const LISTING = hash(4);
const INTEREST = hash(5);

const term = (over: Partial<ExchangeTerm> = {}): ExchangeTerm => ({
  direction: 'Provide',
  resource_conforms_to: 'Web design',
  resource_kind: 'Service',
  quantity: { value: 3, unit: 'hours' },
  ...over
});

/**
 * `counterparty` is whoever did NOT write the agreement up, so the default
 * fixture is a proposal the provider sent to the receiver.
 */
const agreement = (over: Partial<AgreementInDHT> = {}): AgreementInDHT => ({
  listing: LISTING,
  listing_type: 'Offer',
  interest: INTEREST,
  counterparty: RECEIVER,
  provider: PROVIDER,
  receiver: RECEIVER,
  primary: term(),
  reciprocal: term({
    direction: 'Receive',
    resource_kind: 'Currency',
    resource_conforms_to: 'CAD'
  }),
  medium: 'CAD',
  terms: 'Within the month',
  delivery_timeframe: '2 weeks',
  ...over
});

const exchange = (over: Partial<UIExchange> = {}): UIExchange =>
  ({
    agreement_hash: hash(9),
    agreement: agreement(),
    status: 'Proposed',
    created_at: 1_757_000_000_000,
    ...over
  }) as UIExchange;

const accepted = { agreement: hash(9), accepted: true, note: '', created_at: 1 } as const;
const declined = { agreement: hash(9), accepted: false, note: 'no', created_at: 1 } as const;
const review = {
  agreement: hash(9),
  rating: 5,
  on_time: true,
  as_agreed: true,
  comment: '',
  created_at: 1
} as const;

describe('exchange-ui', () => {
  describe('roleOf', () => {
    it('names each side from the agreement', () => {
      expect(roleOf(exchange(), PROVIDER)).toBe('provider');
      expect(roleOf(exchange(), RECEIVER)).toBe('receiver');
    });

    it('is null for anyone who is not a party, and for a member with no user record', () => {
      expect(roleOf(exchange(), STRANGER)).toBeNull();
      expect(roleOf(exchange(), undefined)).toBeNull();
    });
  });

  describe('counterpartyOf', () => {
    it('returns the other party', () => {
      expect(counterpartyOf(exchange(), PROVIDER)).toBe(RECEIVER);
      expect(counterpartyOf(exchange(), RECEIVER)).toBe(PROVIDER);
    });

    it('falls back to the provider for a non-party, since neither side is theirs', () => {
      expect(counterpartyOf(exchange(), STRANGER)).toBe(PROVIDER);
      expect(counterpartyOf(exchange(), undefined)).toBe(PROVIDER);
    });
  });

  describe('wroteIt', () => {
    it('is true for whoever is not named as the counterparty', () => {
      expect(wroteIt(exchange(), PROVIDER)).toBe(true);
      expect(wroteIt(exchange(), RECEIVER)).toBe(false);
    });

    it('follows the counterparty field, not the provider or receiver field', () => {
      const theirs = exchange({ agreement: agreement({ counterparty: PROVIDER }) });
      expect(wroteIt(theirs, PROVIDER)).toBe(false);
      expect(wroteIt(theirs, RECEIVER)).toBe(true);
    });
  });

  describe('doneBy and reviewedBy', () => {
    it('read the side that matches the role', () => {
      const e = exchange({ provider_done: { created_at: 1 }, provider_review: review });
      expect(doneBy(e, 'provider')).toBe(true);
      expect(doneBy(e, 'receiver')).toBe(false);
      expect(reviewedBy(e, 'provider')).toBe(true);
      expect(reviewedBy(e, 'receiver')).toBe(false);
    });

    it('are false with no role, so a non-party is never told something is theirs', () => {
      const e = exchange({ provider_done: { created_at: 1 }, receiver_done: { created_at: 1 } });
      expect(doneBy(e, null)).toBe(false);
      expect(reviewedBy(e, null)).toBe(false);
    });
  });

  describe('otherRole', () => {
    it('swaps the two roles and keeps null null', () => {
      expect(otherRole('provider')).toBe('receiver');
      expect(otherRole('receiver')).toBe('provider');
      expect(otherRole(null)).toBeNull();
    });
  });

  describe('turnOf', () => {
    it('is nobody turn for someone who is not a party', () => {
      expect(turnOf(exchange(), STRANGER)).toBe('none');
      expect(turnOf(exchange(), undefined)).toBe('none');
    });

    it('at Proposed, asks whoever did not write it', () => {
      const e = exchange({ status: 'Proposed' });
      expect(turnOf(e, RECEIVER)).toBe('you');
      expect(turnOf(e, PROVIDER)).toBe('them');
    });

    it('at Agreed, asks whoever has not completed', () => {
      const e = exchange({
        status: 'Agreed',
        response: accepted,
        provider_done: { created_at: 1 }
      });
      expect(turnOf(e, PROVIDER)).toBe('them');
      expect(turnOf(e, RECEIVER)).toBe('you');
    });

    it('at OneSideDone, asks whoever has not completed, either side', () => {
      const providerWent = exchange({ status: 'OneSideDone', response: accepted, provider_done: { created_at: 1 } });
      expect(turnOf(providerWent, RECEIVER)).toBe('you');
      expect(turnOf(providerWent, PROVIDER)).toBe('them');

      const receiverWent = exchange({ status: 'OneSideDone', response: accepted, receiver_done: { created_at: 1 } });
      expect(turnOf(receiverWent, PROVIDER)).toBe('you');
      expect(turnOf(receiverWent, RECEIVER)).toBe('them');
    });

    it('at Complete, asks whoever has not reviewed', () => {
      const e = exchange({ status: 'Complete', response: accepted, provider_review: review });
      expect(turnOf(e, PROVIDER)).toBe('them');
      expect(turnOf(e, RECEIVER)).toBe('you');
    });

    it('asks nobody once the exchange is settled or stopped', () => {
      for (const status of ['Reviewed', 'Declined', 'Cancelled'] as ExchangeStatus[]) {
        const e = exchange({ status, response: accepted });
        expect(turnOf(e, PROVIDER), status).toBe('none');
        expect(turnOf(e, RECEIVER), status).toBe('none');
      }
    });
  });

  describe('awaitingMe', () => {
    it('is exactly turnOf being you, for every status and both parties', () => {
      for (const status of ALL_STATUSES) {
        for (const me of [PROVIDER, RECEIVER, STRANGER]) {
          const e = exchange({ status, response: accepted });
          expect(awaitingMe(e, me), `${status}`).toBe(turnOf(e, me) === 'you');
        }
      }
    });

    it('counts a proposal someone else sent me and not one I sent', () => {
      const e = exchange({ status: 'Proposed' });
      expect(awaitingMe(e, RECEIVER)).toBe(true);
      expect(awaitingMe(e, PROVIDER)).toBe(false);
    });
  });

  describe('tabOf', () => {
    it('groups each status as EXCHANGE_TABS declares', () => {
      expect(tabOf(exchange({ status: 'Proposed' }))).toBe('proposals');
      expect(tabOf(exchange({ status: 'Declined', response: declined }))).toBe('proposals');
      expect(tabOf(exchange({ status: 'Agreed', response: accepted }))).toBe('active');
      expect(tabOf(exchange({ status: 'OneSideDone', response: accepted }))).toBe('active');
      expect(tabOf(exchange({ status: 'Complete', response: accepted }))).toBe('completed');
      expect(tabOf(exchange({ status: 'Reviewed', response: accepted }))).toBe('completed');
    });

    it('puts a withdrawal back with proposals, but a cancellation after acceptance stays active', () => {
      expect(tabOf(exchange({ status: 'Cancelled' }))).toBe('proposals');
      expect(tabOf(exchange({ status: 'Cancelled', response: accepted }))).toBe('active');
    });

    it('lands every status in exactly one tab', () => {
      for (const status of ALL_STATUSES) {
        const e = exchange({ status, response: accepted });
        expect(Object.values(TAB_OF_STATE), status).toContain(tabOf(e));
      }
    });
  });

  describe('statusLabel', () => {
    it('calls a cancellation before any answer a withdrawal', () => {
      expect(statusLabel(exchange({ status: 'Cancelled' }))).toBe('Withdrawn');
      expect(
        statusLabel(exchange({ status: 'Cancelled', response: accepted })),
        'agreed, then stopped'
      ).toBe('Cancelled');
    });

    it('has a label for every status, and it is the label of the state it reads as', () => {
      for (const status of ALL_STATUSES) {
        const e = exchange({ status, response: accepted });
        const label = statusLabel(e);
        expect(label, status).toBeTruthy();
        expect(label, status).toBe(EXCHANGE_STATE_LABEL[exchangeState(e)]);
      }
    });
  });

  describe('exchangeStatusVariant', () => {
    it('returns a Skeleton variant class for every status, never undefined', () => {
      for (const status of ALL_STATUSES) {
        expect(exchangeStatusVariant(status), status).toMatch(/^variant-filled-/);
      }
    });
  });

  describe('termLabel', () => {
    it('says a Tbd term is still to be discussed, whatever else it carries', () => {
      expect(termLabel(term({ resource_kind: 'Tbd' }))).toBe('To be discussed');
    });

    it('says a Gift owes nothing', () => {
      expect(termLabel(term({ resource_kind: 'Gift' }))).toBe('Gift, nothing owed');
    });

    it('prints a currency term as value then currency, with no unit noun', () => {
      const t = term({
        resource_kind: 'Currency',
        resource_conforms_to: 'CAD',
        quantity: { value: 40, unit: 'dollars' }
      });
      expect(termLabel(t)).toBe('40 CAD');
    });

    it('prints a service term as quantity, unit, resource', () => {
      expect(termLabel(term({ quantity: { value: 3, unit: 'hours' } }))).toBe(
        '3 hours of Web design'
      );
    });

    it('singularises the unit when the quantity is one', () => {
      expect(termLabel(term({ quantity: { value: 1, unit: 'hours' } }))).toBe(
        '1 hour of Web design'
      );
    });

    it('falls back to the resource alone when no quantity was given', () => {
      expect(termLabel(term({ quantity: null }))).toBe('Web design');
    });
  });

  describe('actionLabel', () => {
    it('opens a proposal whether it is live or declined', () => {
      expect(actionLabel(exchange({ status: 'Proposed' }), 'receiver')).toBe('Open proposal');
      expect(actionLabel(exchange({ status: 'Declined' }), 'provider')).toBe('Open proposal');
    });

    it('asks whoever has not marked their part done, either side', () => {
      const providerWent = exchange({ status: 'OneSideDone', provider_done: { created_at: 1 } });
      expect(actionLabel(providerWent, 'receiver')).toBe('Mark my part done');
      expect(actionLabel(providerWent, 'provider')).toBe('Open exchange');

      const receiverWent = exchange({ status: 'OneSideDone', receiver_done: { created_at: 1 } });
      expect(actionLabel(receiverWent, 'provider')).toBe('Mark my part done');
      expect(actionLabel(receiverWent, 'receiver')).toBe('Open exchange');
    });

    it('asks for a review only from whoever has not left one', () => {
      const e = exchange({ status: 'Complete', provider_review: review });
      expect(actionLabel(e, 'receiver')).toBe('Leave a review');
      expect(actionLabel(e, 'provider')).toBe('Open exchange');
    });

    it('shows a summary once reviewed, and never returns an empty label', () => {
      expect(actionLabel(exchange({ status: 'Reviewed' }), 'provider')).toBe('View summary');
      for (const status of ALL_STATUSES) {
        expect(actionLabel(exchange({ status }), null), status).toBeTruthy();
      }
    });
  });

  describe('formatWhen', () => {
    it('renders a millisecond timestamp as a readable day', () => {
      const rendered = formatWhen(Date.UTC(2026, 8, 14, 16, 0, 0));
      expect(rendered).toMatch(/2026/);
      expect(rendered).toMatch(/1[34]/);
    });

    it('does not render a microsecond timestamp as a plausible date', () => {
      // Guards the class of bug fixed across five stores in #239: raw Holochain
      // action timestamps are microseconds and land fifty millennia out.
      expect(formatWhen(Date.UTC(2026, 8, 14) * 1000)).not.toMatch(/2026/);
    });
  });
});

describe('reciprocalTermFor', () => {
  /**
   * **A listing that names no medium is still proposable** (Sam, 4 October). Refusing one
   * invented a rule the data does not have, and it blocked the simplest exchange there
   * is: someone offering to help for nothing.
   *
   * **To make this go red:** return a `Tbd` term for the empty medium, as the page did
   * before, or put `!!medium` back in `canSubmit` on the propose page.
   */
  it('makes a listing with no medium a gift, not a blocked proposal', () => {
    const term = reciprocalTermFor({ medium: '', isCurrency: false, returnService: '' });
    expect(term.resource_kind).toBe('Gift');
    expect(term.resource_conforms_to).toBe('');
    expect(term.quantity).toBeNull();
    expect(term.direction).toBe('Receive');
  });

  it('gives Free/Pay it Forward the same shape, since both mean nothing comes back', () => {
    const noMedium = reciprocalTermFor({ medium: '', isCurrency: false, returnService: '' });
    const free = reciprocalTermFor({
      medium: 'Free/Pay it Forward',
      isCurrency: false,
      returnService: ''
    });
    expect(free).toEqual(noMedium);
  });

  it('carries a currency medium with no amount, because no listing publishes one', () => {
    const term = reciprocalTermFor({ medium: 'Hours', isCurrency: true, returnService: '' });
    expect(term.resource_kind).toBe('Currency');
    expect(term.resource_conforms_to).toBe('Hours');
    expect(term.quantity).toBeNull();
  });

  it('carries the chosen return service, and never the none-of-these sentinel', () => {
    expect(
      reciprocalTermFor({
        medium: 'Service Exchange',
        isCurrency: false,
        returnService: 'Bike repairs'
      }).resource_conforms_to
    ).toBe('Bike repairs');

    expect(
      reciprocalTermFor({
        medium: 'Service Exchange',
        isCurrency: false,
        returnService: '__none__'
      }).resource_conforms_to
    ).toBe('');
  });
});

/**
 * **One reading of the record, so four questions cannot disagree about it.**
 *
 * The label on a card, the group it sits in, whose turn it is and whether a conversation
 * shows it as an agreement are four readings of one fact. Each used to read the status
 * for itself, and two of them had to compensate for a status that cannot say
 * "withdrawn": one asked `Cancelled && !response`, another asked `response.accepted`.
 * Two spellings of the same question in one codebase is how they drift apart.
 */
describe('exchangeState, the record read once', () => {
  it('names the state for every status the zome can answer', () => {
    expect(exchangeState(exchange({ status: 'Proposed' }))).toBe('proposed');
    expect(exchangeState(exchange({ status: 'Declined', response: declined }))).toBe('declined');
    expect(exchangeState(exchange({ status: 'Agreed', response: accepted }))).toBe('agreed');
    expect(exchangeState(exchange({ status: 'OneSideDone', response: accepted }))).toBe(
      'partlyDone'
    );
    expect(exchangeState(exchange({ status: 'Complete', response: accepted }))).toBe(
      'awaitingReviews'
    );
    expect(exchangeState(exchange({ status: 'Reviewed', response: accepted }))).toBe('reviewed');
  });

  /**
   * **To make this go red:** return `'cancelled'` for every `Cancelled` exchange. A
   * proposal taken back before anyone answered reads as an agreement that was stopped,
   * which is the claim Sam saw announced to both people.
   */
  it('tells a withdrawal from a cancellation by the response, not the status', () => {
    expect(exchangeState(exchange({ status: 'Cancelled' })), 'nobody answered it').toBe(
      'withdrawn'
    );
    expect(
      exchangeState(exchange({ status: 'Cancelled', response: accepted })),
      'it was agreed, then stopped'
    ).toBe('cancelled');
  });

  /**
   * A refusal stays a refusal. Either party may cancel at any time, so a cancellation can
   * land on a proposal that was already declined, and the decline is what happened to it.
   */
  it('keeps a declined proposal declined when a cancellation lands on top of it', () => {
    const e = exchange({ status: 'Cancelled', response: declined });
    expect(exchangeState(e)).toBe('declined');
    expect(statusLabel(e), 'and the label follows the state').toBe('Declined');
  });

  it('has a label and exactly one tab for every state, with nothing left unplaced', () => {
    for (const state of Object.keys(
      EXCHANGE_STATE_LABEL
    ) as (keyof typeof EXCHANGE_STATE_LABEL)[]) {
      expect(EXCHANGE_STATE_LABEL[state], state).toBeTruthy();
      expect(['proposals', 'active', 'completed'], state).toContain(TAB_OF_STATE[state]);
    }
  });

  /**
   * The point of the whole change: the four readers answer from the same derivation, so a
   * withdrawal reads as one thing everywhere it appears.
   */
  it('reads a withdrawal the same way in the label, the tab, the turn and the card', () => {
    const withdrawn = exchange({
      status: 'Cancelled',
      cancellation: { agreement: hash(9), note: '', created_at: 1 }
    });
    expect(exchangeState(withdrawn)).toBe('withdrawn');
    expect(statusLabel(withdrawn)).toBe('Withdrawn');
    expect(tabOf(withdrawn), 'it never became an exchange').toBe('proposals');
    expect(turnOf(withdrawn, RECEIVER), 'nothing is asked of either side').toBe('none');
    expect(actionLabel(withdrawn, 'receiver'), 'a proposal is what there is to open').toBe(
      'Open proposal'
    );
  });
});

/**
 * **A hash in a link means nothing until a record says it does.**
 *
 * The propose page is opened with an interest hash in its address, and only the
 * listing's own interests can say whether that hash is one of them. Read and absent is
 * its own answer: the interest may have been withdrawn, or the link kept from an older
 * one, and the page has to stop rather than fill itself in from the query string.
 */
describe('namedInterest, matching a link against the records', () => {
  const INTEREST = hash(7);
  const listed = [{ interest_hash: hash(7), user: PROVIDER }, { interest_hash: hash(8) }];

  /**
   * **To make this go red:** compare the hashes with `===`, or with `includes`. Two
   * `Uint8Array`s holding the same bytes are different objects, so the page would never
   * find the interest it was opened from and would call every proposal impossible.
   */
  it('finds it by what the hash holds, not by which object it is', () => {
    const found = namedInterest(listed, new Uint8Array([132, 41, 36, 7]) as unknown as ActionHash);
    expect(found?.user, 'the interest, with whoever registered it').toBe(PROVIDER);
  });

  it('finds nothing when the listing has no such interest', () => {
    expect(namedInterest(listed, hash(99))).toBeUndefined();
  });

  it('and nothing when the link names none at all', () => {
    expect(namedInterest(listed, null)).toBeUndefined();
    expect(namedInterest([], INTEREST)).toBeUndefined();
  });
});
