import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import ListingInterest from '$lib/components/exchanges/ListingInterest.svelte';
import type { UIUser } from '$lib/types/ui';

/**
 * **The listing keeps its door when the read fails** (review of 16 October, F11).
 *
 * A toast that fades and a block that renders nothing left the listing with no Show
 * interest and no way to reach the other person, which reads as "nothing to do here".
 */

const getInterestsForListing = vi.fn();

vi.mock('@skeletonlabs/skeleton', () => ({
  getModalStore: () => ({ trigger: vi.fn() }),
  getToastStore: () => ({ trigger: vi.fn() })
}));

vi.mock('$lib/stores/exchanges.store.svelte', () => ({
  default: {
    getInterestsForListing: () => getInterestsForListing(),
    createInterest: vi.fn(),
    withdrawInterest: vi.fn()
  }
}));

vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    // Accepted, since only an accepted member may act on a listing (#336).
    currentUser: {
      original_action_hash: new Uint8Array(Array(39).fill(1)),
      status: { status_type: 'accepted' }
    },
    getUserByActionHash: () => Promise.resolve(null)
  }
}));

vi.mock('$lib/utils/effect', () => ({ runEffect: <T>(value: T) => value }));
vi.mock('$lib/utils/toast', () => ({ showToast: vi.fn() }));

const LISTING = new Uint8Array(Array(39).fill(5));
const AUTHOR = new Uint8Array(Array(39).fill(9));
const MY_INTEREST = {
  interest_hash: new Uint8Array(Array(39).fill(3)),
  listing: LISTING,
  listing_type: 'Offer',
  created_at: Date.now(),
  user: new Uint8Array(Array(39).fill(1))
};

const mount = () =>
  render(ListingInterest, {
    props: {
      listingHash: LISTING,
      listingType: 'Offer',
      listingTitle: 'Garden clearance',
      creator: { original_action_hash: AUTHOR, name: 'Anita Rossi' } as UIUser,
      organization: null,
      isCreator: false
    }
  });

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the listing door when the interests cannot be read', () => {
  it('shows the fault with its reason and a way to try again', async () => {
    getInterestsForListing.mockRejectedValue(new Error('get_interests_for_listing: no answer'));
    mount();

    const fault = await screen.findByRole('alert');
    expect(fault.textContent).toContain('no answer');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('Try again reads again, and the door appears once that works', async () => {
    getInterestsForListing.mockRejectedValueOnce(new Error('once')).mockResolvedValue([]);
    mount();

    await fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByTestId('show-interest')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(getInterestsForListing).toHaveBeenCalledTimes(2);
  });
});

/**
 * **Reaching the author comes after showing interest** (Sam, 5 November).
 *
 * Showing interest is where an exchange begins, and its record is what a conversation and
 * a proposal hang off. With nothing plugged in, what this renders is the Contact button;
 * Go to chat takes the same place when messaging is, so gating the place gates both.
 *
 * **To make this go red:** render ReachPerson outside the `mine` branch again.
 */
describe('reaching the author', () => {
  it('is not offered before interest is shown', async () => {
    getInterestsForListing.mockResolvedValue([]);
    mount();

    expect(await screen.findByTestId('show-interest')).toBeTruthy();
    expect(screen.queryByTestId('contact-person')).toBeNull();
    expect(screen.queryByTestId('contact-unavailable')).toBeNull();
  });

  it('is offered once it is, full width', async () => {
    getInterestsForListing.mockResolvedValue([MY_INTEREST]);
    mount();

    const reach = await screen.findByTestId('contact-unavailable');
    expect(reach).toBeTruthy();
    expect(screen.queryByTestId('show-interest')).toBeNull();
  });
});
