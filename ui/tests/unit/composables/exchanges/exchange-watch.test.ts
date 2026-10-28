import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { state, hash } = vi.hoisted(() => ({
  state: {
    status: 'Agreed' as string,
    reads: 0,
    failing: false,
    // When set, the next read waits for release() before answering, with the
    // status as it was when the read was asked.
    hold: false,
    release: null as null | (() => void)
  },
  hash: (n: number) => new Uint8Array([n, n, n, n])
}));

// Store methods return tokens; the runEffect stub below resolves them.
vi.mock('$lib/stores/exchanges.store.svelte', () => ({
  default: { getExchange: () => 'exchange', complete: () => 'complete' }
}));
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: { currentUser: { original_action_hash: hash(3) }, getUserByActionHash: () => 'user' }
}));
vi.mock('$lib/stores/offers.store.svelte', () => ({ default: { getOffer: () => 'listing' } }));
vi.mock('$lib/stores/requests.store.svelte', () => ({ default: { getRequest: () => 'listing' } }));
vi.mock('$lib/composables/connection/useConnectionGuard', () => ({
  useConnectionGuard: () => 'guard'
}));
vi.mock('$lib/utils/toast', () => ({ showToast: vi.fn() }));
vi.mock('$lib/utils/effect', () => ({
  runEffect: async (token: string) => {
    if (token === 'complete') {
      state.status = 'OneSideDone';
      return exchangeWith('OneSideDone');
    }
    if (token === 'exchange') {
      state.reads += 1;
      if (state.failing) throw new Error('no answer');
      const status = state.status;
      if (state.hold) {
        state.hold = false;
        await new Promise<void>((resolve) => (state.release = resolve));
      }
      return exchangeWith(status);
    }
    if (token === 'listing') return { title: 'A listing' };
    return null;
  }
}));

function exchangeWith(status: string) {
  return {
        agreement_hash: hash(10),
        status,
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

import {
  isSettled,
  useExchangeDetails
} from '$lib/composables/domain/exchanges/useExchangeDetails.svelte';

describe('isSettled (#334)', () => {
  it('is true once nothing more can happen', () => {
    for (const status of ['Reviewed', 'Declined', 'Cancelled']) {
      expect(isSettled({ status } as never)).toBe(true);
    }
  });

  it('is false while the exchange can still move', () => {
    for (const status of ['Proposed', 'Agreed', 'OneSideDone', 'Complete']) {
      expect(isSettled({ status } as never)).toBe(false);
    }
    expect(isSettled(null)).toBe(false);
  });
});

describe('useExchangeDetails watch (#334)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.status = 'Agreed';
    state.reads = 0;
    state.failing = false;
    state.hold = false;
    state.release = null;
  });
  afterEach(() => vi.useRealTimers());

  it('re-reads the exchange while it is open, so the other side shows', async () => {
    const details = useExchangeDetails({ agreementHash: () => hash(10) });
    await details.initialize();
    const stop = details.watch();
    expect(state.reads).toBe(1);
    state.status = 'OneSideDone';
    await vi.advanceTimersByTimeAsync(15_000);
    expect(state.reads).toBe(2);
    expect(details.exchange?.status).toBe('OneSideDone');
    stop();
  });

  it('stops re-reading, and clears its timer, once the exchange is settled', async () => {
    const details = useExchangeDetails({ agreementHash: () => hash(10) });
    await details.initialize();
    details.watch();
    state.status = 'Reviewed';
    await vi.advanceTimersByTimeAsync(15_000);
    expect(details.exchange?.status).toBe('Reviewed');
    await vi.advanceTimersByTimeAsync(15_000);
    const readsWhenSettled = state.reads;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(state.reads).toBe(readsWhenSettled);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('says it is showing the last update after repeated failed reads, and recovers', async () => {
    const details = useExchangeDetails({ agreementHash: () => hash(10) });
    await details.initialize();
    const stop = details.watch();
    state.failing = true;
    await vi.advanceTimersByTimeAsync(15_000 * 2);
    expect(details.stale).toBe(false);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(details.stale).toBe(true);
    expect(details.exchange?.status).toBe('Agreed');
    state.failing = false;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(details.stale).toBe(false);
    stop();
  });

  it("keeps the member's own move when an older re-read answers after it", async () => {
    const details = useExchangeDetails({ agreementHash: () => hash(10) });
    await details.initialize();
    const stop = details.watch();
    state.hold = true;
    window.dispatchEvent(new Event('focus')); // a re-read starts, and is slow
    await vi.advanceTimersByTimeAsync(0);
    expect(state.release).not.toBeNull();
    expect(await details.complete()).toBe(true); // the member marks done meanwhile
    expect(details.exchange?.status).toBe('OneSideDone');
    state.release!(); // the old read lands, still saying Agreed
    await vi.advanceTimersByTimeAsync(0);
    expect(details.exchange?.status).toBe('OneSideDone');
    stop();
  });

  it("clears the stale notice when the member's own write gets through", async () => {
    const details = useExchangeDetails({ agreementHash: () => hash(10) });
    await details.initialize();
    const stop = details.watch();
    state.failing = true;
    await vi.advanceTimersByTimeAsync(15_000 * 3);
    expect(details.stale).toBe(true);
    expect(await details.complete()).toBe(true);
    expect(details.stale).toBe(false);
    stop();
  });
});
