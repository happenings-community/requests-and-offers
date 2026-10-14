import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import ShowInterestButton from '$lib/components/exchanges/ShowInterestButton.svelte';

/**
 * **The one place this button is shown is a listing card inside a conversation.**
 *
 * So after showing interest there is nothing more to offer: a way into the conversation
 * would point at the page the member is already reading, and the badge saying it worked is
 * the whole of what changed. It also does not take them anywhere, because nothing exists to
 * go to until somebody proposes.
 */

const createInterest = vi.fn();
const getMyInterests = vi.fn();
const getUserByActionHash = vi.fn();

// The contact pop-up is opened through a modal store, so a way of reaching the other
// person creeping back in here would need one. Stubbed for the same reason as the user
// read below: the test should fail on its assertion, not on a gap in its setup.
vi.mock('@skeletonlabs/skeleton', () => ({
  getModalStore: () => ({ trigger: vi.fn() })
}));

vi.mock('$lib/stores/exchanges.store.svelte', () => ({
  default: {
    createInterest: (...args: unknown[]) => createInterest(...args),
    getMyInterests: () => getMyInterests()
  }
}));

vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    currentUser: { original_action_hash: new Uint8Array(Array(39).fill(1)) },
    // Answered, so that a way of reaching the other person creeping back in here fails on
    // the assertion that it should not be there, rather than on a gap in this mock.
    getUserByActionHash: (hash: unknown) => getUserByActionHash(hash)
  }
}));

vi.mock('$lib/utils/effect', () => ({
  runEffect: <T>(value: T) => value
}));

const LISTING = new Uint8Array(Array(39).fill(5));
const AUTHOR = new Uint8Array(Array(39).fill(9));

beforeEach(() => {
  cleanup();
  createInterest.mockReset();
  getMyInterests.mockReset();
  getUserByActionHash.mockReset();
  getMyInterests.mockResolvedValue([]);
  createInterest.mockResolvedValue(undefined);
  getUserByActionHash.mockResolvedValue({ name: 'Anita Rossi', email: 'a@example.org' });
});

describe('showing interest from a listing card in a conversation', () => {
  it('records the interest and says so', async () => {
    render(ShowInterestButton, {
      props: { listing: LISTING, listingType: 'Offer', author: AUTHOR }
    });

    (await screen.findByTestId('show-interest')).click();

    expect(await screen.findByText("You're interested")).toBeTruthy();
    expect(createInterest).toHaveBeenCalledTimes(1);
  });

  /**
   * **To make this go red:** put the way of reaching the other person back beside the
   * badge. In a conversation it addresses the conversation the member is reading.
   */
  it('and offers no way to the chat, which is where the member already is', async () => {
    render(ShowInterestButton, {
      props: { listing: LISTING, listingType: 'Offer', author: AUTHOR }
    });

    (await screen.findByTestId('show-interest')).click();
    await screen.findByText("You're interested");

    expect(screen.queryByTestId('go-to-chat'), 'no chat link').toBeNull();
    expect(screen.queryByTestId('contact-person'), 'and no contact button either').toBeNull();

    // The one that cannot pass by being early: anything offering a way to reach the other
    // person reads their details as it mounts, so a silent spy is proof none is here.
    expect(
      getUserByActionHash,
      'nothing here reads the other person at all'
    ).not.toHaveBeenCalled();
  });

  it('takes the member nowhere, because there is nothing yet to go to', async () => {
    const { container } = render(ShowInterestButton, {
      props: { listing: LISTING, listingType: 'Offer', author: AUTHOR }
    });

    (await screen.findByTestId('show-interest')).click();
    await screen.findByText("You're interested");

    expect(container.querySelector('a'), 'nothing links away').toBeNull();
  });

  it('shows the author nothing at all on their own listing', async () => {
    render(ShowInterestButton, {
      props: {
        listing: LISTING,
        listingType: 'Offer',
        author: new Uint8Array(Array(39).fill(1))
      }
    });

    expect(screen.queryByTestId('show-interest')).toBeNull();
  });
});
