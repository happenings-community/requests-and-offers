import { describe, it, expect, vi, beforeEach } from 'vitest';

const { state, hash, showToast } = vi.hoisted(() => ({
  state: { failRead: false, interests: [] as unknown[] },
  hash: (n: number) => new Uint8Array([n, n, n, n]),
  showToast: vi.fn()
}));

type Token = { kind: string };

vi.mock('$lib/stores/exchanges.store.svelte', () => ({
  default: { getInterestsForListing: (): Token => ({ kind: 'interests' }) }
}));
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    currentUser: { original_action_hash: hash(3) },
    getUserByActionHash: (): Token => ({ kind: 'user' })
  }
}));
vi.mock('$lib/utils/toast', () => ({ showToast }));
vi.mock('$lib/utils/effect', () => ({
  runEffect: async (token: Token) => {
    if (token.kind === 'interests') {
      if (state.failRead) throw new Error('read failed');
      return state.interests;
    }
    return { name: 'Agent 2' };
  }
}));

import { useListingInterest } from '$lib/composables/domain/exchanges/useListingInterest.svelte';

const interestBy = (user: number) => ({
  interest_hash: hash(20 + user),
  listing: hash(1),
  listing_type: 'Offer',
  user: hash(user),
  created_at: 1
});

describe('useListingInterest reads (#344)', () => {
  beforeEach(() => {
    state.failRead = false;
    state.interests = [];
    showToast.mockClear();
  });

  const make = (quiet = false) =>
    useListingInterest({ listingHash: () => hash(1), listingType: () => 'Offer', quiet });

  it('lists everyone interested except me, once read', async () => {
    state.interests = [interestBy(3), interestBy(4)];
    const interest = make();
    await interest.load();
    expect(interest.loaded).toBe(true);
    expect(interest.loadFailed).toBe(false);
    expect(interest.others.map((i) => i.user)).toEqual([hash(4)]);
  });

  it('marks a failed first read as unknown, not as nobody interested', async () => {
    state.failRead = true;
    const interest = make(true);
    await interest.load();
    expect(interest.loaded).toBe(false);
    expect(interest.loadFailed).toBe(true);
  });

  it('stays quiet when asked, and toasts otherwise', async () => {
    state.failRead = true;
    await make(true).load();
    expect(showToast).not.toHaveBeenCalled();
    await make(false).load();
    expect(showToast).toHaveBeenCalledWith('read failed', 'error');
  });

  it('clears the failure once a retry succeeds', async () => {
    state.failRead = true;
    const interest = make(true);
    await interest.load();
    state.failRead = false;
    state.interests = [interestBy(4)];
    await interest.load();
    expect(interest.loadFailed).toBe(false);
    expect(interest.others).toHaveLength(1);
  });
});
