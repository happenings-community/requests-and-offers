import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';

// The counter page, mounted, with a member typing into its two amount inputs.
// What is asserted is what reaches the counter zome call: the inputs are text
// inputs, so a typed amount must arrive as an exact decimal string, never a float.

const { state, hash, showToast, goto } = vi.hoisted(() => ({
  state: { sent: null as unknown, calls: 0 },
  hash: (n: number) => new Uint8Array([132, 41, 36, ...new Array(33).fill(n), 0, 0, 0, 0]),
  showToast: vi.fn(),
  goto: vi.fn()
}));

type Token = { kind: string; input?: unknown };

vi.mock('$app/state', async () => {
  const { encodeHashToBase64 } = await import('@holochain/client');
  return { page: { params: { id: encodeHashToBase64(hash(10)) } } };
});
vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$lib/stores/exchanges.store.svelte', () => ({
  default: {
    getExchange: (): Token => ({ kind: 'exchange' }),
    counter: (input: unknown): Token => ({ kind: 'counter', input })
  }
}));
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    currentUser: { original_action_hash: hash(3) },
    getUserByActionHash: (): Token => ({ kind: 'user' })
  }
}));
vi.mock('$lib/stores/offers.store.svelte', () => ({
  default: { getOffer: (): Token => ({ kind: 'listing' }) }
}));
vi.mock('$lib/stores/requests.store.svelte', () => ({
  default: { getRequest: (): Token => ({ kind: 'listing' }) }
}));
vi.mock('$lib/composables/connection/useConnectionGuard', () => ({
  useConnectionGuard: (): Token => ({ kind: 'guard' })
}));
vi.mock('$lib/utils/toast', () => ({ showToast }));
vi.mock('$lib/utils/effect', () => ({
  runEffect: async (token: Token) => {
    switch (token.kind) {
      case 'exchange':
        return {
          agreement_hash: hash(10),
          status: 'Proposed',
          agreement: {
            listing: hash(1),
            listing_type: 'Offer',
            interest: hash(2),
            counterparty: hash(3),
            provider: hash(4),
            receiver: hash(3),
            primary: {
              direction: 'Provide',
              resource_conforms_to: 'Gardening',
              resource_kind: 'Service',
              quantity: { value: '3', unit: 'hours' }
            },
            reciprocal: {
              direction: 'Receive',
              resource_conforms_to: 'CAD',
              resource_kind: 'Currency',
              quantity: { value: '40', unit: 'CAD' }
            },
            medium: 'CAD',
            terms: '',
            delivery_timeframe: { Preset: 'WithinTwoWeeks' }
          }
        };
      case 'listing':
        return { title: 'A listing' };
      case 'user':
        return { name: 'Agent 2' };
      case 'counter':
        state.sent = structuredClone(token.input);
        state.calls += 1;
        return { agreement_hash: hash(11) };
      default:
        return null;
    }
  }
}));

import CounterPage from '../../../../src/routes/(public)/exchanges/[id]/counter/+page.svelte';

type Sent = {
  primary_quantity: { value: string; unit: string } | null;
  reciprocal_quantity: { value: string; unit: string } | null;
};

async function mounted() {
  render(CounterPage);
  return {
    primary: (await screen.findByTestId('counter-primary')) as HTMLInputElement,
    reciprocal: (await screen.findByTestId('counter-reciprocal')) as HTMLInputElement,
    send: (await screen.findByTestId('send-counter')) as HTMLButtonElement
  };
}

async function type(input: HTMLInputElement, text: string) {
  await fireEvent.input(input, { target: { value: text } });
}

describe('the counter page, typed into', () => {
  beforeEach(() => {
    state.sent = null;
    state.calls = 0;
    showToast.mockClear();
    goto.mockClear();
  });
  afterEach(() => cleanup());

  it('opens with the proposal as typed text, not numbers', async () => {
    const { primary, reciprocal, send } = await mounted();
    expect(primary.value).toBe('3');
    expect(reciprocal.value).toBe('40');
    expect(send.disabled).toBe(true);
  });

  it('sends a decimal comma as a dot, and keeps trailing zeros as written', async () => {
    const { primary, reciprocal, send } = await mounted();
    await type(primary, '1,5');
    await type(reciprocal, ' 42.50 ');
    expect(send.disabled).toBe(false);
    await fireEvent.click(send);
    await vi.waitFor(() => expect(state.calls).toBe(1));
    const sent = state.sent as Sent;
    expect(sent.primary_quantity).toEqual({ value: '1.5', unit: 'hours' });
    expect(sent.reciprocal_quantity).toEqual({ value: '42.50', unit: 'CAD' });
    expect(typeof sent.primary_quantity?.value).toBe('string');
  });

  // #380: the select is bound by index, because a timeframe is an object.
  it('opens on the proposed timeframe and sends the one chosen, as a typed value', async () => {
    const { send } = await mounted();
    const select = screen.getByTestId('counter-timeframe') as HTMLSelectElement;
    expect(select.options[select.selectedIndex].text).toBe('Within 2 weeks of agreeing');
    const flexible = [...select.options].findIndex((o) => o.text === 'Flexible');
    select.selectedIndex = flexible;
    await fireEvent.change(select);
    expect(send.disabled).toBe(false);
    await fireEvent.click(send);
    await vi.waitFor(() => expect(state.calls).toBe(1));
    expect((state.sent as { delivery_timeframe: unknown }).delivery_timeframe).toEqual({
      Preset: 'Flexible'
    });
  });

  it('refuses a thousands comma, says how to write it, and sends nothing', async () => {
    const { reciprocal, send } = await mounted();
    await type(reciprocal, '1,000');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('1000');
    expect(send.disabled).toBe(true);
    await fireEvent.click(send);
    expect(state.calls).toBe(0);
  });

  it('reads the same amount in another spelling as no change', async () => {
    const { primary, reciprocal, send } = await mounted();
    await type(primary, '3.00');
    await type(reciprocal, '40.0');
    expect(send.disabled).toBe(true);
    await fireEvent.click(send);
    expect(state.calls).toBe(0);
  });
});
