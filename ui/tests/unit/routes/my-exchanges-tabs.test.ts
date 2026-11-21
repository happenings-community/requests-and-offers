import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import MyExchangesPage from '../../../src/routes/(public)/exchanges/+page.svelte';

/**
 * My Exchanges' outer switch, Exchanges or Interested in, as tabs a keyboard can work, and
 * the exchange groups under it as the filters they are.
 *
 * Both were buttons marked as tabs and nothing more: no panel, no arrow keys, and all of
 * them in the tab order. The WAI-ARIA tabs pattern is what a screen reader announces "tab"
 * for, so it is kept for the switch, which has a panel; the groups only filter the one list
 * below, so they are toggle buttons.
 */

vi.mock('$lib/composables/domain/exchanges/useExchangesManagement.svelte', async () => ({
  // Reactive, as the real one is: the page binds its filters to it.
  useExchangesManagement: (await import('../../mocks/reactive.svelte')).reactive({
    me: undefined,
    tab: 'all',
    side: 'all',
    origin: 'all',
    turn: 'all',
    order: 'newest',
    error: null,
    ready: true,
    shown: [],
    filtered: [],
    initialize: () => Promise.resolve(),
    countIn: () => 0,
    nameOf: () => undefined,
    pictureOf: () => undefined,
    titleOf: () => undefined,
    lastActivity: () => undefined
  }).factory
}));
vi.mock('$lib/stores/exchanges.store.svelte', () => ({
  default: { exchanges: [], getMyInterests: () => Promise.resolve([]) }
}));
vi.mock('$lib/utils/effect', () => ({ runEffect: () => Promise.resolve([]) }));
vi.mock('$lib/components/exchanges/InterestedIn.svelte', async () => ({
  default: (await import('../../mocks/Empty.svelte')).default
}));

const tabs = () => screen.getAllByRole('tab') as HTMLButtonElement[];

beforeEach(() => cleanup());

describe('the Exchanges and Interested in tabs', () => {
  it('has one tab in the tab order, and a panel the selected tab controls', () => {
    render(MyExchangesPage);
    const [exchanges, interested] = tabs();

    expect(exchanges.getAttribute('aria-selected')).toBe('true');
    expect(exchanges.tabIndex).toBe(0);
    expect(interested.tabIndex).toBe(-1);
    const panel = screen.getByRole('tabpanel');
    expect(exchanges.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(exchanges.id);
  });

  it('moves between them with the arrow keys, Home and End, taking the focus along', async () => {
    render(MyExchangesPage);
    const [exchanges] = tabs();
    exchanges.focus();

    await fireEvent.keyDown(exchanges, { key: 'ArrowRight' });
    let [, interested] = tabs();
    expect(interested.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(interested);
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(interested.id);

    await fireEvent.keyDown(interested, { key: 'ArrowRight' });
    expect(tabs()[0].getAttribute('aria-selected'), 'and round again').toBe('true');

    await fireEvent.keyDown(tabs()[0], { key: 'ArrowLeft' });
    expect(tabs()[1].getAttribute('aria-selected'), 'and back the other way').toBe('true');
    expect(document.activeElement).toBe(tabs()[1]);
    await fireEvent.keyDown(tabs()[1], { key: 'ArrowLeft' });
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');

    await fireEvent.keyDown(tabs()[0], { key: 'End' });
    [, interested] = tabs();
    expect(interested.getAttribute('aria-selected')).toBe('true');
    await fireEvent.keyDown(interested, { key: 'Home' });
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
  });

  it('offers the exchange groups as toggle buttons, not as tabs with no panel', async () => {
    render(MyExchangesPage);
    const groups = screen.getByRole('group', { name: 'Exchange groups' });
    const buttons = Array.from(groups.querySelectorAll('button'));

    expect(tabs()).toHaveLength(2);
    expect(buttons.length).toBeGreaterThan(1);
    const pressed = () => buttons.filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(buttons.every((b) => b.hasAttribute('aria-pressed'))).toBe(true);
    expect(pressed()).toHaveLength(1);

    const before = pressed()[0];
    const other = buttons.find((b) => b !== before) as HTMLButtonElement;
    await fireEvent.click(other);
    expect(pressed()).toEqual([other]);
  });

  /**
   * The root layout used to centre a page shorter than the window, and Interested in is shorter
   * than Exchanges, so switching tabs moved the whole page up and down. Filling the height
   * keeps it at the top. **To make it go red:** drop `flex-1` from the page's section.
   */
  it('fills the height, so switching tabs does not move the page', () => {
    render(MyExchangesPage);
    const section = screen.getByRole('heading', { name: 'My Exchanges' }).closest('section');
    expect(section?.classList.contains('flex-1')).toBe(true);
  });
});
