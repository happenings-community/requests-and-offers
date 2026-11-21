import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import MilestoneLine from '$lib/components/messaging/MilestoneLine.svelte';
import type { UIExchange } from '$lib/types/ui';
import type { Milestone } from '$lib/utils/messaging-threads';

/**
 * What happened to an agreement afterwards, as a line in the conversation: who marked
 * their part done (you, or the other person by name), both done, or cancelled, each with
 * a way into the exchange that comes back to this conversation.
 */

const hash = (n: number) => new Uint8Array(Array(39).fill(n));
const ME = hash(1);
const ANITA = hash(2);
const exchange = {
  agreement_hash: hash(50),
  created_at: 1,
  status: 'OneSideDone',
  agreement: { provider: ME, receiver: ANITA, counterparty: ANITA }
} as unknown as UIExchange;

const mount = (milestone: Milestone) =>
  render(MilestoneLine, {
    props: { exchange, milestone, name: 'Anita', me: ME, counterparty: ANITA }
  });

beforeEach(() => cleanup());

describe('a line for what happened to an agreement', () => {
  it('says "You" for my own part, and names the other person for theirs', () => {
    mount('providerDone');
    expect(screen.getByText('You marked your part done')).toBeTruthy();
    cleanup();
    mount('receiverDone');
    expect(screen.getByText('Anita marked their part done')).toBeTruthy();
  });

  it('says when both parts are done, and when the agreement was cancelled', () => {
    mount('bothDone');
    expect(screen.getByText('Both parts are done')).toBeTruthy();
    cleanup();
    mount('cancelled');
    expect(screen.getByText('The agreement was cancelled')).toBeTruthy();
  });

  it('opens the exchange, carrying the way back to this conversation', () => {
    mount('receiverDone');
    const link = screen.getByRole('link', { name: 'Open the exchange' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toMatch(/^\/exchanges\/.+from=/);
  });
});
