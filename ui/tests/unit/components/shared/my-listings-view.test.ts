import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import { replaceState } from '$app/navigation';
import MyListings from '$lib/components/shared/listings/MyListings.svelte';
import { visit } from '../../../mocks/app-state';

/**
 * My Listings comes back to the view you last had (Sam, 18 November): choosing a view
 * remembers it for this window and writes it into the address, so Back from a listing and
 * the menu link both return to it, while a link that asks for a view still gets that one.
 */

vi.mock('$lib/stores/requests.store.svelte', async () => {
  const { Effect: E } = await import('effect');
  return {
    default: {
      getUserActiveRequests: () => E.succeed([]),
      getUserArchivedRequests: () => E.succeed([])
    }
  };
});
vi.mock('$lib/stores/offers.store.svelte', async () => {
  const { Effect: E } = await import('effect');
  return {
    default: {
      getUserActiveOffers: () => E.succeed([]),
      getUserArchivedOffers: () => E.succeed([])
    }
  };
});
vi.mock('$lib/stores/exchanges.store.svelte', async () => {
  const { Effect: E } = await import('effect');
  return { default: { exchanges: [], loadMyExchanges: () => E.succeed([]) } };
});
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: { currentUser: { status: { status_type: 'accepted' } } }
}));

const userHash = new Uint8Array(Array(39).fill(1));
const viewButton = (name: RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.mocked(replaceState).mockClear();
  visit('/my-listings');
});

describe('My Listings remembers its view', () => {
  it('writes the view you choose into the address and remembers it', async () => {
    render(MyListings, { props: { userHash } });
    await fireEvent.click(viewButton(/Active offers/));

    expect(viewButton(/Active offers/).getAttribute('aria-pressed')).toBe('true');
    expect(vi.mocked(replaceState).mock.calls.at(-1)?.[0]).toBe('/my-listings?view=offers');
    expect(sessionStorage.getItem('my-listings-view')).toBe('offers');
  });

  it('opens on the remembered view when the link asks for none, as the menu link does', () => {
    sessionStorage.setItem('my-listings-view', 'archived');
    render(MyListings, { props: { userHash } });

    expect(viewButton(/Archived/).getAttribute('aria-pressed')).toBe('true');
  });

  it('opens the view a link asks for, over the remembered one', () => {
    sessionStorage.setItem('my-listings-view', 'archived');
    visit('/my-listings?view=offers');
    render(MyListings, { props: { userHash } });

    expect(viewButton(/Active offers/).getAttribute('aria-pressed')).toBe('true');
  });
});
