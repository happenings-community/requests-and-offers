import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ChipTip from '$lib/components/shared/ChipTip.svelte';

/**
 * A service type or medium tag cuts a long name with an ellipsis (#576), and Electron on
 * macOS shows no `title`, so the tag draws the whole name above the chip on hover, and on
 * keyboard focus where the tag is a link.
 */
describe('ChipTip', () => {
  it('draws the whole text, for the eye only, above the chip', () => {
    render(ChipTip, { text: 'Holochain Zome Development (Rust)' });
    const tip = screen.getByTestId('chip-tip');
    expect(tip.textContent).toBe('Holochain Zome Development (Rust)');
    expect(
      tip.getAttribute('aria-hidden'),
      'the name is already in the chip for a screen reader'
    ).toBe('true');
    expect(tip.className, 'above, so a table scroll area does not cut it off').toMatch(
      /\bbottom-full\b/
    );
    expect(tip.className).not.toMatch(/\btop-full\b/);
  });

  it('shows on hover of its chip and on keyboard focus of a link chip, and wraps a long name', () => {
    render(ChipTip, { text: 'x' });
    const cls = screen.getByTestId('chip-tip').className;
    expect(cls).toMatch(/\bopacity-0\b/);
    expect(cls).toMatch(/\bgroup-hover:opacity-100\b/);
    expect(cls).toMatch(/\bgroup-focus-visible:opacity-100\b/);
    expect(cls).toMatch(/\bwhitespace-normal\b/);
    expect(cls).toMatch(/\bmax-w-xs\b/);
    expect(cls, 'never in the way of a click').toMatch(/\bpointer-events-none\b/);
    expect(cls, "cancels Skeleton's gap between a chip's children").toMatch(
      /(?:^|\s)!ml-0(?:\s|$)/
    );
  });
});
