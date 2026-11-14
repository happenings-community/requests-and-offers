import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/svelte';
import { Effect as E } from 'effect';
import { goto } from '../../../mocks/app-navigation';
import ShareListing from '$lib/components/messaging/ShareListing.svelte';

/**
 * Sending a listing just published to the person the member was talking to.
 *
 * What goes is a card: the listing, and no text. A refusal says so with its reason, and
 * a card that went is never reported as one that did not.
 */

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('$lib/stores/messaging.store.svelte', () => ({
  default: { send: (...a: unknown[]) => send(...a) }
}));
vi.mock('$lib/stores/users.store.svelte', async () => {
  const { Effect } = await import('effect');
  return { default: { getUserByActionHash: () => Effect.succeed({ name: 'Anita Rossi' }) } };
});

const LISTING = new Uint8Array(Array(39).fill(7));
const ANITA = new Uint8Array(Array(39).fill(3));
const BACK = '/messages/anita';

const mount = (listing: Uint8Array | null = LISTING) =>
  render(ShareListing, { props: { listing, counterparty: ANITA, conversation: BACK } });
const button = () => screen.getByTestId('share-with') as HTMLButtonElement;

beforeEach(() => {
  cleanup();
  send.mockReset();
  send.mockReturnValue(E.succeed(undefined));
  goto.mockReset();
  goto.mockResolvedValue(undefined);
});

describe('sharing a listing just published', () => {
  it('sends the listing as a card, with no text, and goes back to the conversation', async () => {
    mount();
    await fireEvent.click(button());

    await waitFor(() => expect(goto).toHaveBeenCalledWith(BACK));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(ANITA, '', LISTING);
  });

  it('names the person it will go to', async () => {
    mount();
    expect(await screen.findByRole('button', { name: 'Share it with Anita Rossi' })).toBeTruthy();
  });

  it('says it could not be shared, with the reason, and stays on the page', async () => {
    send.mockReturnValue(E.fail(new Error('Only an accepted member can send')));
    mount();
    await fireEvent.click(button());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('That could not be shared');
    expect(alert.textContent).toContain('Only an accepted member can send');
    expect(goto).not.toHaveBeenCalled();
    expect(button().disabled, 'and can be tried again').toBe(false);
  });

  it('sends one card for a second click while the first is going', async () => {
    send.mockReturnValue(E.sleep('40 millis').pipe(E.as(undefined)));
    mount();

    void fireEvent.click(button());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(button().disabled).toBe(true);
    void fireEvent.click(button());
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(send).toHaveBeenCalledTimes(1);
  });

  /** The card has gone by then: saying it had not invites sending it twice. */
  it('does not say the share failed because the way back did', async () => {
    goto.mockRejectedValue(new Error('navigation cancelled'));
    mount();
    await fireEvent.click(button());

    await waitFor(() => expect(goto).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('offers nothing to send before there is a listing', () => {
    mount(null);
    expect(button().disabled).toBe(true);
  });
});
