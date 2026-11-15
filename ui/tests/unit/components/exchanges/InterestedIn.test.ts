import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/svelte';
import { encodeHashToBase64 } from '@holochain/client';
import InterestedIn from '$lib/components/exchanges/InterestedIn.svelte';

/**
 * My Exchanges' "Interested in" tab: the listings a member has shown interest in, each
 * with a Withdraw.
 *
 * A withdrawal is one at a time and says so when it is refused: it could be pressed twice
 * and sent twice, and a refusal was an unhandled rejection with nothing on screen.
 */

const { withdrawInterest, getMyInterests } = vi.hoisted(() => ({
  withdrawInterest: vi.fn(),
  getMyInterests: vi.fn()
}));
const LISTING = new Uint8Array(Array(39).fill(5));
const INTEREST = {
  interest_hash: new Uint8Array(Array(39).fill(3)),
  listing: LISTING,
  listing_type: 'Offer',
  created_at: 1_760_000_000_000,
  user: new Uint8Array(Array(39).fill(1))
};

vi.mock('@skeletonlabs/skeleton', () => ({
  getModalStore: () => ({ trigger: vi.fn() }),
  getToastStore: () => ({ trigger: vi.fn() })
}));
vi.mock('$lib/stores/exchanges.store.svelte', () => ({
  default: {
    exchanges: [],
    getMyInterests: () => getMyInterests(),
    withdrawInterest: (h: unknown) => withdrawInterest(h)
  }
}));
vi.mock('$lib/stores/offers.store.svelte', () => ({
  default: {
    getOffer: () =>
      Promise.resolve({ title: 'Garden clearance', creator: new Uint8Array(Array(39).fill(9)) })
  }
}));
vi.mock('$lib/stores/requests.store.svelte', () => ({ default: { getRequest: vi.fn() } }));
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    currentUser: null,
    getUserByActionHash: () => Promise.resolve({ name: 'Anita Rossi' })
  }
}));
vi.mock('$lib/utils/effect', () => ({ runEffect: <T>(value: T) => value }));

const withdrawButton = () =>
  screen.findByRole('button', { name: 'Withdraw interest' }) as Promise<HTMLButtonElement>;

beforeEach(() => {
  cleanup();
  withdrawInterest.mockReset();
  getMyInterests.mockReset();
  getMyInterests.mockResolvedValue([INTEREST]);
});

describe('withdrawing interest from My Exchanges', () => {
  it('withdraws the interest on the row pressed', async () => {
    withdrawInterest.mockResolvedValue(undefined);
    render(InterestedIn);
    await fireEvent.click(await withdrawButton());

    await waitFor(() => expect(withdrawInterest).toHaveBeenCalledTimes(1));
    expect(withdrawInterest).toHaveBeenCalledWith(INTEREST.interest_hash);
  });

  it('sends one withdrawal for a second press while the first is going', async () => {
    let finish: () => void = () => {};
    withdrawInterest.mockImplementation(() => new Promise<void>((r) => (finish = r)));
    render(InterestedIn);
    const button = await withdrawButton();

    await fireEvent.click(button);
    expect(button.disabled).toBe(true);
    await fireEvent.click(button);
    finish();

    await waitFor(() => expect(getMyInterests).toHaveBeenCalledTimes(2));
    expect(withdrawInterest).toHaveBeenCalledTimes(1);
  });

  it('says why when a withdrawal is refused, and can be tried again', async () => {
    withdrawInterest.mockRejectedValue(new Error('the conductor refused'));
    render(InterestedIn);
    await fireEvent.click(await withdrawButton());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("Your interest wasn't withdrawn");
    expect(alert.textContent).toContain('the conductor refused');
    expect((await withdrawButton()).disabled).toBe(false);
  });

  it('links to the listing as the rest of the app does', async () => {
    render(InterestedIn);
    const link = await screen.findByRole('link', { name: 'View listing' });
    expect(link.getAttribute('href')).toBe(`/offers/${encodeHashToBase64(LISTING)}`);
  });
});
