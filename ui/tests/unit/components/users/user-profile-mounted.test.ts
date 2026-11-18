import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import type { UIUser } from '$lib/types/ui';
import { tick } from 'svelte';

// Children that need SvelteKit or a store of their own are stubbed: the header is what is under test.
const stub = vi.hoisted(() => () => ({ default: () => {} }));
vi.mock('$lib/components/shared/BackButton.svelte', stub);
vi.mock('$lib/components/shared/listings/ListingCard.svelte', stub);
vi.mock('$lib/components/shared/MarkdownRenderer.svelte', stub);
vi.mock('$lib/components/shared/status/StatusHistoryModal.svelte', stub);
vi.mock('$lib/components/users/ProgenitorBadge.svelte', stub);
vi.mock('@skeletonlabs/skeleton', () => ({
  getModalStore: () => ({ trigger: vi.fn(), update: vi.fn() }),
  getToastStore: () => ({ trigger: vi.fn() })
}));
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: { currentUser: null, getUserStatusLink: vi.fn() }
}));
vi.mock('$lib/stores/administration.store.svelte', () => ({
  default: { isProgenitor: false, getEntityStatusHistory: vi.fn() }
}));
vi.mock('$lib/stores/organizations.store.svelte', async () => {
  const { Effect: E } = await import('effect');
  return {
    default: {
      getUserOrganizations: () => E.succeed([]),
      isOrganizationCoordinator: () => E.succeed(false)
    }
  };
});
const reads = vi.hoisted(() => ({ requests: 0 }));
vi.mock('$lib/stores/requests.store.svelte', async () => {
  const { Effect: E } = await import('effect');
  return {
    default: {
      getUserActiveRequests: () =>
        E.sync(() => {
          reads.requests += 1;
          return [];
        })
    }
  };
});
vi.mock('$lib/stores/offers.store.svelte', async () => {
  const { Effect: E } = await import('effect');
  return { default: { getUserActiveOffers: () => E.succeed([]) } };
});
vi.mock('$lib/stores/exchanges.store.svelte', async () => {
  const { Effect: E } = await import('effect');
  return { default: { exchanges: [], loadMyExchanges: () => E.succeed([]) } };
});

import UserProfile from '$lib/components/users/UserProfile.svelte';

const member = (status: Record<string, unknown>) =>
  ({
    name: 'Sam Doe',
    nickname: 'sam',
    user_type: 'creator',
    original_action_hash: new Uint8Array([132, 41, 36, 1]),
    status
  }) as unknown as UIUser;

afterEach(cleanup);

describe('UserProfile header, mounted (#353 review)', () => {
  it('shows the reason of an ended suspension that reads "In review"', () => {
    render(UserProfile, {
      props: {
        user: member({
          status_type: 'suspended temporarily',
          suspended_until: '2020-01-01T00:00:00Z',
          reason: 'Repeated no-shows'
        })
      }
    });
    expect(screen.getByTestId('status-chip').textContent).toBe('In review');
    expect(screen.getByText(/Repeated no-shows/)).toBeTruthy();
  });

  it('keeps an information request to the member alone (#331)', () => {
    const user = member({ status_type: 'pending', reason: 'Which community are you from?' });
    render(UserProfile, { props: { user } });
    expect(screen.queryByText(/Which community are you from\?/)).toBeNull();
    cleanup();
    render(UserProfile, { props: { user, isCurrentUser: true } });
    expect(screen.getByText(/Which community are you from\?/)).toBeTruthy();
    expect(screen.getByText('Information requested:')).toBeTruthy();
  });

  it("offers the status history on the member's own view only", () => {
    // The history table prints every revision's reason, including an information
    // request kept to the member (#331); administrators read it from the admin pages.
    const user = member({ status_type: 'pending', reason: 'Which community are you from?' });
    render(UserProfile, { props: { user } });
    expect(screen.queryByTestId('status-history-link')).toBeNull();
    cleanup();
    render(UserProfile, { props: { user, isCurrentUser: true } });
    expect(screen.getByTestId('status-history-link')).toBeTruthy();
  });

  it('loads once for a fresh copy of the same member', async () => {
    // Opening your own profile refreshes your record, which hands the profile a new copy
    // of the same member. Reloading on that loaded everything twice, and the page jumped.
    const user = member({ status_type: 'pending' });
    const { rerender } = render(UserProfile, { props: { user, isCurrentUser: true } });
    await tick();
    const before = reads.requests;
    await rerender({ user: member({ status_type: 'pending' }), isCurrentUser: true });
    await tick();
    expect(reads.requests).toBe(before);
  });
});
