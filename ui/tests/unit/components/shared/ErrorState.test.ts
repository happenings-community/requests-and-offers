import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import ErrorState from '$lib/components/shared/ErrorState.svelte';

describe('ErrorState', () => {
  /** A fixed id was shared by every instance, so a second card named itself by the first's title. */
  it('names each card by its own title', () => {
    const one = render(ErrorState, { title: 'First', body: 'a' }).container;
    const two = render(ErrorState, { title: 'Second', body: 'b' }).container;
    const label = (c: HTMLElement) => {
      const card = c.querySelector('[data-testid="error-state"]')!;
      return document.getElementById(card.getAttribute('aria-labelledby')!)?.textContent?.trim();
    };
    expect(label(one)).toBe('First');
    expect(label(two)).toBe('Second');
  });
});
