import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * An exchange can move while its page is open: the other member withdraws, declines or
 * cancels, and this page learns of it only at its next re-read. Dogfooding on 21 November
 * found Accept clicked on a proposal Bob had withdrawn a few seconds before: nothing was
 * accepted, the page flipped to "Withdrawn by the proposer", and nothing said why.
 *
 * Every irreversible action now reads the exchange first and refuses, with a message
 * naming what happened, when it is no longer in the state the button belongs to; and a
 * write the network refuses is followed by a read that says the same thing when the
 * exchange moved. **To make these go red:** drop the read before the write in `act`, or
 * the read after a refused write.
 */

const { state, hash, toast } = vi.hoisted(() => ({
  state: {
    // What the network holds now; the page loads it once, then it may change underneath.
    status: 'Proposed' as string,
    response: null as null | { accepted: boolean; note: string; created_at: number },
    cancellation: null as null | { note: string; created_at: number },
    writes: [] as string[],
    refuseWrite: false
  },
  hash: (n: number) => new Uint8Array([n, n, n, n]),
  toast: vi.fn()
}));

vi.mock('$lib/stores/exchanges.store.svelte', () => ({
  default: {
    getExchange: () => 'exchange',
    respond: (_h: unknown, accepted: boolean) => (accepted ? 'accept' : 'decline'),
    cancel: () => 'cancel',
    complete: () => 'complete'
  }
}));
vi.mock('$lib/stores/users.store.svelte', () => ({
  // This member is the counterparty (hash 4); Bob (hash 3) wrote the proposal.
  default: { currentUser: { original_action_hash: hash(4) }, getUserByActionHash: () => 'user' }
}));
vi.mock('$lib/stores/offers.store.svelte', () => ({ default: { getOffer: () => 'listing' } }));
vi.mock('$lib/stores/requests.store.svelte', () => ({ default: { getRequest: () => 'listing' } }));
vi.mock('$lib/composables/connection/useConnectionGuard', () => ({
  useConnectionGuard: () => 'guard'
}));
vi.mock('$lib/utils/toast', () => ({ showToast: toast }));
vi.mock('$lib/utils/effect', () => ({
  runEffect: async (token: string) => {
    if (token === 'exchange') return current();
    if (token === 'user') return { name: 'Bob' };
    if (token === 'listing') return { title: 'Garden help' };
    if (['accept', 'decline', 'cancel', 'complete'].includes(token)) {
      if (state.refuseWrite) throw new Error('this proposal was withdrawn');
      state.writes.push(token);
      if (token === 'accept') {
        state.status = 'Agreed';
        state.response = { accepted: true, note: '', created_at: 2 };
      }
      return current();
    }
    return null;
  }
}));

function current() {
  return {
    agreement_hash: hash(10),
    status: state.status,
    response: state.response,
    cancellation: state.cancellation,
    created_at: 1,
    agreement: {
      listing: hash(1),
      listing_type: 'Offer',
      interest: hash(2),
      counterparty: hash(4),
      provider: hash(3),
      receiver: hash(4)
    }
  };
}

function withdrawnByBob() {
  state.status = 'Cancelled';
  state.response = null;
  state.cancellation = { note: 'Withdrawn by the proposer', created_at: 3 };
}

import { useExchangeDetails } from '$lib/composables/domain/exchanges/useExchangeDetails.svelte';

describe('an action on an exchange that moved while the page was open', () => {
  beforeEach(() => {
    state.status = 'Proposed';
    state.response = null;
    state.cancellation = null;
    state.writes = [];
    state.refuseWrite = false;
    toast.mockClear();
  });

  it('refuses Accept on a proposal withdrawn since the page loaded, and says so', async () => {
    const details = useExchangeDetails({ agreementHash: () => hash(10) });
    await details.initialize();
    expect(details.exchange?.status).toBe('Proposed');

    withdrawnByBob();
    const ok = await details.accept();

    expect(ok).toBe(false);
    expect(state.writes).toEqual([]);
    expect(details.exchange?.status).toBe('Cancelled');
    expect(toast).toHaveBeenCalledTimes(1);
    const [message, type] = toast.mock.calls[0];
    expect(type).toBe('error');
    expect(message).toBe(
      'Bob withdrew this proposal before your answer reached it. Nothing was changed.'
    );
  });

  it('refuses Decline the same way', async () => {
    const details = useExchangeDetails({ agreementHash: () => hash(10) });
    await details.initialize();
    withdrawnByBob();
    expect(await details.decline()).toBe(false);
    expect(state.writes).toEqual([]);
    expect(toast.mock.calls[0][0]).toContain('withdrew this proposal');
  });

  it('still accepts a proposal that has not moved', async () => {
    const details = useExchangeDetails({ agreementHash: () => hash(10) });
    await details.initialize();
    expect(await details.accept()).toBe(true);
    expect(state.writes).toEqual(['accept']);
    expect(toast).toHaveBeenCalledWith('Agreement accepted', 'success');
  });

  it('explains a write the network refused when a re-read shows the exchange moved', async () => {
    const details = useExchangeDetails({ agreementHash: () => hash(10) });
    await details.initialize();
    // The withdrawal lands between the check and the write: the zome refuses the write.
    state.refuseWrite = true;
    const realAccept = details.accept;
    const pending = realAccept();
    withdrawnByBob();
    expect(await pending).toBe(false);
    expect(details.exchange?.status).toBe('Cancelled');
    expect(toast.mock.calls.at(-1)?.[0]).toBe(
      'Bob withdrew this proposal before your answer reached it. Nothing was changed.'
    );
  });

  it('shows the network error as it is when the exchange did not move', async () => {
    const details = useExchangeDetails({ agreementHash: () => hash(10) });
    await details.initialize();
    state.refuseWrite = true;
    expect(await details.accept()).toBe(false);
    expect(details.exchange?.status).toBe('Proposed');
    expect(toast).toHaveBeenCalledWith('this proposal was withdrawn', 'error');
  });
});
