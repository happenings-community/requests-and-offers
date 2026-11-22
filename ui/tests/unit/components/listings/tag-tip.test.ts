import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { Effect as E } from 'effect';

/**
 * A cut tag name is drawn in full above its chip (ChipTip), because Electron on macOS does
 * not show the chip's title. Rendered: the tip must show only when the name's own text
 * span is cut, measured on hover (and on focus where the tag is a link), and the error
 * chip must do the same with its whole error. The browser does no layout here, so the
 * widths are stubbed: a `truncate` span is 300px of text in a 100px box when `cut` is set.
 */

const store = vi.hoisted(() => ({
  serviceType: { fail: false },
  medium: { fail: false }
}));

vi.mock('$lib/utils/holochain-client.utils', () => ({
  waitForHolochainConnection: vi.fn(async () => {})
}));
vi.mock('$lib/stores/serviceTypes.store.svelte', () => ({
  default: {
    getServiceType: vi.fn(() =>
      store.serviceType.fail
        ? E.fail(new Error('boom'))
        : E.succeed({ name: 'Holochain Zome Development (Rust)', description: 'Zomes' })
    )
  }
}));
vi.mock('$lib/stores/mediums_of_exchange.store.svelte', () => ({
  default: {
    getMediumOfExchange: vi.fn(() =>
      store.medium.fail
        ? E.fail(new Error('boom'))
        : E.succeed({ name: 'Time banking hours (community pool)', exchange_type: 'base' })
    )
  }
}));

import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';
import MediumOfExchangeTag from '$lib/components/mediums-of-exchange/MediumOfExchangeTag.svelte';

let cut = true;
const saved = {
  scrollWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth'),
  clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
};
beforeEach(() => {
  cut = true;
  store.serviceType.fail = false;
  store.medium.fail = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('truncate') && cut ? 300 : 100;
    }
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 100
  });
});
afterAll(() => {
  for (const [key, d] of Object.entries(saved)) {
    if (d) Object.defineProperty(HTMLElement.prototype, key, d);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
  }
});

const hash = new Uint8Array(39).fill(1);
const tip = () => screen.queryByTestId('chip-tip');

describe('ServiceTypeTag draws a cut name above itself', () => {
  for (const showLink of [true, false]) {
    it(`${showLink ? 'as a link' : 'as a span'}: on hover, only while the name is cut`, async () => {
      const { container } = render(ServiceTypeTag, { serviceTypeActionHash: hash, showLink });
      await waitFor(() => expect(container.textContent).toContain('Holochain Zome'));
      const chip = container.querySelector('.chip') as HTMLElement;
      expect(chip.tagName).toBe(showLink ? 'A' : 'SPAN');
      expect(tip(), 'nothing before a hover').toBeNull();

      await fireEvent.mouseEnter(chip);
      expect(tip()?.textContent).toBe('Holochain Zome Development (Rust)');

      cut = false;
      await fireEvent.mouseEnter(chip);
      expect(tip(), 'a name with room shows no tip').toBeNull();
    });
  }

  it('as a link, on keyboard focus too', async () => {
    const { container } = render(ServiceTypeTag, { serviceTypeActionHash: hash });
    await waitFor(() => expect(container.textContent).toContain('Holochain Zome'));
    await fireEvent.focusIn(container.querySelector('a.chip') as HTMLElement);
    expect(tip()?.textContent).toBe('Holochain Zome Development (Rust)');
  });

  it('an error chip draws the whole error', async () => {
    store.serviceType.fail = true;
    const { container } = render(ServiceTypeTag, { serviceTypeActionHash: hash });
    await waitFor(() => expect(container.querySelector('.variant-soft-error')).not.toBeNull());
    await fireEvent.mouseEnter(container.querySelector('.chip') as HTMLElement);
    expect(tip()?.textContent).toBe('Error loading service type: Failed to load service type');
  });
});

describe('MediumOfExchangeTag draws a cut name above itself', () => {
  it('on hover, only while the name is cut', async () => {
    const { container } = render(MediumOfExchangeTag, { mediumOfExchangeActionHash: hash });
    await waitFor(() => expect(container.textContent).toContain('Time banking'));
    const chip = container.querySelector('.chip') as HTMLElement;
    expect(tip()).toBeNull();
    await fireEvent.mouseEnter(chip);
    expect(tip()?.textContent).toBe('Time banking hours (community pool)');
    cut = false;
    await fireEvent.mouseEnter(chip);
    expect(tip()).toBeNull();
  });

  it('an error chip draws the whole error', async () => {
    store.medium.fail = true;
    const { container } = render(MediumOfExchangeTag, { mediumOfExchangeActionHash: hash });
    await waitFor(() => expect(container.querySelector('.variant-soft-error')).not.toBeNull());
    await fireEvent.mouseEnter(container.querySelector('.chip') as HTMLElement);
    expect(tip()?.textContent).toMatch(/^Error loading medium of exchange: /);
  });
});
