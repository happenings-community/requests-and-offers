import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect as E } from 'effect';

const mocks = vi.hoisted(() => ({ getLatestRequest: vi.fn(), getLatestOffer: vi.fn() }));
vi.mock('$lib/stores/requests.store.svelte', () => ({
  default: { getLatestRequest: mocks.getLatestRequest }
}));
vi.mock('$lib/stores/offers.store.svelte', () => ({
  default: { getLatestOffer: mocks.getLatestOffer }
}));

import { useListingSources } from '$lib/composables/domain/hrea/useListingSources.svelte';

describe('useListingSources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 1,1,1 is an edited offer, read at its latest revision; 6,6,6 cannot be read now;
    // 7,7,7 no longer exists.
    mocks.getLatestOffer.mockImplementation((h: Uint8Array) =>
      h[0] === 6
        ? E.fail(new Error('timeout'))
        : E.succeed(h[0] === 7 ? null : { title: 'Offer 1 Update', original_action_hash: h })
    );
    mocks.getLatestRequest.mockImplementation(() => E.succeed({ title: 'Soup' }));
  });

  it('finds an edited listing by the original hash a proposal is mapped under', async () => {
    const sources = useListingSources();
    await sources.track([
      { kind: 'offer', hash: '1,1,1' },
      { kind: 'request', hash: '2,2,2' }
    ]);
    expect(sources.found.get('1,1,1')?.title).toBe('Offer 1 Update');
    expect(sources.found.get('2,2,2')?.title).toBe('Soup');
    expect(mocks.getLatestOffer.mock.calls[0][0]).toEqual(new Uint8Array([1, 1, 1]));
    expect(mocks.getLatestRequest).toHaveBeenCalledTimes(1);
  });

  it('reads each listing once, and asks again only after a failed call', async () => {
    const sources = useListingSources();
    await sources.track([
      { kind: 'offer', hash: '1,1,1' },
      { kind: 'offer', hash: '6,6,6' }
    ]);
    await sources.track([
      { kind: 'offer', hash: '1,1,1' },
      { kind: 'offer', hash: '6,6,6' }
    ]);
    expect(mocks.getLatestOffer).toHaveBeenCalledTimes(3);
    expect(sources.found.has('6,6,6')).toBe(false);
  });

  it('asks again after a read throws, keeping the rest of the batch', async () => {
    mocks.getLatestRequest.mockImplementation(() =>
      E.sync(() => {
        throw new Error('decode failed');
      })
    );
    const sources = useListingSources();
    await sources.track([
      { kind: 'request', hash: '2,2,2' },
      { kind: 'offer', hash: '1,1,1' }
    ]);
    expect(sources.found.has('2,2,2')).toBe(false);
    expect(sources.found.get('1,1,1')?.title).toBe('Offer 1 Update');
    await sources.track([{ kind: 'request', hash: '2,2,2' }]);
    expect(mocks.getLatestRequest).toHaveBeenCalledTimes(2);
  });

  it('reads every listing afresh after a reset', async () => {
    const sources = useListingSources();
    await sources.track([{ kind: 'offer', hash: '1,1,1' }]);
    sources.reset();
    expect(sources.found.size).toBe(0);
    await sources.track([{ kind: 'offer', hash: '1,1,1' }]);
    expect(mocks.getLatestOffer).toHaveBeenCalledTimes(2);
  });

  it('leaves a listing that no longer exists not found', async () => {
    const sources = useListingSources();
    await sources.track([{ kind: 'offer', hash: '7,7,7' }]);
    expect(sources.found.has('7,7,7')).toBe(false);
  });
});
