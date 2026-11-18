import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import { Effect as E } from 'effect';
import SharedListingCard from '$lib/components/messaging/SharedListingCard.svelte';

/**
 * A listing sent as a card. It is drawn from the listing itself, so it can say only what
 * the listing says, and a read that failed is a fault with a way to try again rather
 * than a card that says "A listing".
 */

const { typeOf, getOffer, getRequest } = vi.hoisted(() => ({
  typeOf: vi.fn(),
  getOffer: vi.fn(),
  getRequest: vi.fn()
}));

vi.mock('$lib/stores/offers.store.svelte', () => ({
  default: {
    getListingType: (...a: unknown[]) => typeOf(...a),
    getOffer: (...a: unknown[]) => getOffer(...a)
  }
}));
vi.mock('$lib/stores/requests.store.svelte', () => ({
  default: { getRequest: (...a: unknown[]) => getRequest(...a) }
}));
vi.mock('$lib/components/exchanges/ShowInterestButton.svelte', async () => ({
  default: (await import('../../../mocks/Empty.svelte')).default
}));

const LISTING = new Uint8Array(Array(39).fill(7));
const mount = (mine = false) =>
  render(SharedListingCard, { props: { listing: LISTING, mine, name: 'Anita' } });

beforeEach(() => {
  cleanup();
  for (const call of [typeOf, getOffer, getRequest]) call.mockReset();
  typeOf.mockReturnValue(E.succeed('Request'));
  getRequest.mockReturnValue(E.succeed({ title: 'Bike repair', creator: LISTING }));
  getOffer.mockReturnValue(E.succeed({ title: 'Spare bike', creator: LISTING }));
});

describe('a shared listing card', () => {
  it('shows a request as a request, read as one', async () => {
    mount();

    expect(await screen.findByText('Bike repair')).toBeTruthy();
    expect(screen.getByText(/Request$/)).toBeTruthy();
    expect(getOffer, 'never read as an offer').not.toHaveBeenCalled();
    expect(screen.getByRole('link').getAttribute('href')).toContain('/requests/');
  });

  it('shows an offer as an offer', async () => {
    typeOf.mockReturnValue(E.succeed('Offer'));
    mount();

    expect(await screen.findByText('Spare bike')).toBeTruthy();
    expect(screen.getByText(/Offer$/)).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toContain('/offers/');
  });

  it('says who shared it', async () => {
    mount(true);
    expect(await screen.findByText(/You shared/i)).toBeTruthy();
  });

  it('says the read failed, with the reason, and reads again when asked', async () => {
    typeOf.mockReturnValueOnce(E.fail(new Error('get_record: no answer')));
    mount();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('no answer');
    expect(screen.queryByText('Bike repair')).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Bike repair')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says so when the listing is no longer there', async () => {
    typeOf.mockReturnValue(E.succeed(null));
    mount();

    expect(await screen.findByText(/no longer/i)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('a long word in a shared listing', () => {
  /**
   * A listing title with no spaces breaks inside the card rather than pushing the
   * conversation wider. **To make it go red:** drop `[overflow-wrap:anywhere]` from the card.
   */
  it('wraps inside the card', async () => {
    getRequest.mockReturnValue(E.succeed({ title: 'b'.repeat(500), creator: LISTING }));
    mount();

    expect(await screen.findByText('b'.repeat(500))).toBeTruthy();
    expect(screen.getByTestId('shared-listing-card').className).toContain(
      '[overflow-wrap:anywhere]'
    );
  });
});
