import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import ProposalCard from '$lib/components/messaging/ProposalCard.svelte';
import type { UIExchange } from '$lib/types/ui';

/**
 * **Each side of a waiting proposal has its move on the card** (Sam, 9 November).
 *
 * The receiver could accept or decline from the conversation; the proposer saw "Waiting
 * for them" and nothing to press, and had to find My Exchanges to withdraw.
 */

const ME = new Uint8Array(Array(39).fill(1));
const THEM = new Uint8Array(Array(39).fill(2));
const AGREEMENT = new Uint8Array(Array(39).fill(3));

const term = { resource_kind: 'Gift', resource_conforms_to: 'Gift' };
const proposal = (counterparty: Uint8Array): UIExchange =>
  ({
    agreement_hash: AGREEMENT,
    status: 'Proposed',
    created_at: Date.now(),
    agreement: { counterparty, primary: term, reciprocal: term, delivery_timeframe: 'Soon' }
  }) as unknown as UIExchange;

const onRespond = vi.fn().mockResolvedValue(undefined);
const onWithdraw = vi.fn().mockResolvedValue(undefined);

const mount = (exchange: UIExchange) =>
  render(ProposalCard, { props: { exchange, name: 'Anita', me: ME, onRespond, onWithdraw } });

beforeEach(() => {
  cleanup();
  onRespond.mockClear();
  onWithdraw.mockClear();
});

describe('a proposal waiting for an answer', () => {
  it('offers the proposer Withdraw, and not Accept or Decline', async () => {
    mount(proposal(THEM));
    const withdraw = screen.getByTestId('proposal-withdraw');
    expect(screen.queryByText('Accept')).toBeNull();
    expect(screen.queryByText('Decline')).toBeNull();
    expect(screen.queryByTestId('proposal-counter')).toBeNull();

    await fireEvent.click(withdraw);
    expect(onWithdraw).toHaveBeenCalledWith(AGREEMENT);
    expect(onRespond).not.toHaveBeenCalled();
  });

  it('offers the receiver Accept, Counter and Decline, and not Withdraw', () => {
    mount(proposal(ME));
    expect(screen.getByText('Accept')).toBeTruthy();
    expect(screen.getByText('Decline')).toBeTruthy();
    expect(screen.getByTestId('proposal-counter').getAttribute('href')).toContain('/counter');
    expect(screen.queryByTestId('proposal-withdraw')).toBeNull();
  });

  it('offers nothing once withdrawn', () => {
    mount({ ...proposal(THEM), status: 'Cancelled' } as UIExchange);
    expect(screen.queryByTestId('proposal-withdraw')).toBeNull();
    expect(screen.queryByText('Accept')).toBeNull();
  });
});
