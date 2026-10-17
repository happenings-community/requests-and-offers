import { describe, it, expect, vi, beforeEach } from 'vitest';

const { state, hash, showToast } = vi.hoisted(() => ({
  state: {
    calls: [] as string[],
    failCreate: false,
    failDecline: false,
    status: 'Proposed' as string,
    counterparty: 3
  },
  hash: (n: number) => new Uint8Array([n, n, n, n]),
  showToast: vi.fn()
}));

type Token = { kind: string; input?: unknown };

// Store methods return tokens; the runEffect stub below resolves them in order.
vi.mock('$lib/stores/exchanges.store.svelte', () => ({
  default: {
    getExchange: (): Token => ({ kind: 'exchange' }),
    createAgreement: (input: unknown): Token => ({ kind: 'create', input }),
    respond: (_h: unknown, accepted: boolean, note: string): Token => ({
      kind: 'respond',
      input: { accepted, note }
    })
  }
}));
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    currentUser: { original_action_hash: hash(3) },
    getUserByActionHash: (): Token => ({ kind: 'user' })
  }
}));
vi.mock('$lib/stores/offers.store.svelte', () => ({
  default: { getOffer: (): Token => ({ kind: 'listing' }) }
}));
vi.mock('$lib/stores/requests.store.svelte', () => ({
  default: { getRequest: (): Token => ({ kind: 'listing' }) }
}));
vi.mock('$lib/composables/connection/useConnectionGuard', () => ({
  useConnectionGuard: (): Token => ({ kind: 'guard' })
}));
vi.mock('$lib/utils/toast', () => ({ showToast }));
vi.mock('$lib/utils/effect', () => ({
  runEffect: async (token: Token) => {
    switch (token.kind) {
      case 'exchange':
        return {
          agreement_hash: hash(10),
          status: state.status,
          agreement: {
            listing: hash(1),
            listing_type: 'Offer',
            interest: hash(2),
            counterparty: hash(state.counterparty),
            provider: hash(4),
            receiver: hash(3),
            primary: {
              direction: 'Provide',
              resource_conforms_to: 'Gardening',
              resource_kind: 'Service',
              quantity: { value: 3, unit: 'hours' }
            },
            reciprocal: {
              direction: 'Receive',
              resource_conforms_to: '',
              resource_kind: 'Gift',
              quantity: null
            },
            medium: 'Free/Pay it Forward',
            terms: '',
            delivery_timeframe: 'Within 2 weeks'
          }
        };
      case 'listing':
        return { title: 'A listing' };
      case 'user':
        return { name: 'Agent 2' };
      case 'create':
        state.calls.push('create');
        if (state.failCreate) throw new Error('create refused');
        return { agreement_hash: hash(11) };
      case 'respond':
        state.calls.push('decline');
        if (state.failDecline) throw new Error('decline refused');
        return {};
      default:
        return null;
    }
  }
}));

import {
  COUNTERED_NOTE,
  useCounterProposal
} from '$lib/composables/domain/exchanges/useCounterProposal.svelte';

describe('useCounterProposal (#332)', () => {
  beforeEach(() => {
    state.calls = [];
    state.failCreate = false;
    state.failDecline = false;
    state.status = 'Proposed';
    state.counterparty = 3;
    showToast.mockClear();
  });

  const loaded = async () => {
    const counter = useCounterProposal({ agreementHash: () => hash(10) });
    await counter.initialize();
    return counter;
  };

  it('opens with the proposal as it stands, and nothing to send yet', async () => {
    const counter = await loaded();
    expect(counter.canCounter).toBe(true);
    expect(counter.primary).toBe(3);
    expect(counter.timeframe).toBe('Within 2 weeks');
    expect(counter.figure).toBeNull();
    expect(counter.problem).not.toBeNull();
  });

  it('creates the counter before declining the original', async () => {
    const counter = await loaded();
    counter.timeframe = 'Flexible';
    const created = await counter.send();
    expect(state.calls).toEqual(['create', 'decline']);
    expect(created).toEqual(hash(11));
    expect(showToast).toHaveBeenCalledWith('Counter-proposal sent', 'success');
  });

  it('leaves the original open when the counter cannot be created', async () => {
    state.failCreate = true;
    const counter = await loaded();
    counter.primary = 5;
    expect(await counter.send()).toBeNull();
    expect(state.calls).toEqual(['create']);
  });

  it('still goes to the counter, and says so, when only the decline fails', async () => {
    state.failDecline = true;
    const counter = await loaded();
    counter.primary = 0;
    expect(await counter.send()).toEqual(hash(11));
    expect(showToast.mock.calls[0][0]).toContain('original is still open');
  });

  it('sends nothing while nothing has changed', async () => {
    const counter = await loaded();
    expect(await counter.send()).toBeNull();
    expect(state.calls).toEqual([]);
  });

  it('is not offered to the member who wrote the proposal, or once it is answered', async () => {
    state.counterparty = 4;
    expect((await loaded()).canCounter).toBe(false);
    state.counterparty = 3;
    state.status = 'Declined';
    expect((await loaded()).canCounter).toBe(false);
  });

  it('records the same decline note the exchange page shows', () => {
    expect(COUNTERED_NOTE).toBe('Countered with a new proposal');
  });
});
