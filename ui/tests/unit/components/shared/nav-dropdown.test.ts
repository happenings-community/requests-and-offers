import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import NavDropdown from '$lib/components/shared/NavDropdown.svelte';

/**
 * The menu's own handlers (#204, and the #352 review): opening from the
 * keyboard lands on an item, Escape returns to the trigger, leaving by Tab
 * closes, and a mouse leaving while a keyboard user is inside does not.
 * `menuKeyTarget` (arrows, Home, End between items) has its own tests.
 */

const ITEMS = [
  { href: '/a', label: 'Alpha', icon: 'a' },
  { href: '/b', label: 'Beta', icon: 'b' },
  { href: '/c', label: 'Gamma', icon: 'c' }
];

const mount = () => render(NavDropdown, { props: { title: 'Menu', items: ITEMS } });
const trigger = () => screen.getByRole('button', { name: 'Menu menu' });
const item = (label: string) => screen.getByRole('menuitem', { name: new RegExp(label) });

beforeEach(cleanup);

describe('NavDropdown', () => {
  it('adds a hint to the trigger name, after any count (#361 on #411)', () => {
    render(NavDropdown, {
      props: {
        title: 'Admin',
        items: [{ ...ITEMS[0], badge: 1 }],
        badgeLabel: 'waiting to be accepted',
        hint: 'Accept your membership to finish setup'
      }
    });
    expect(
      screen.getByRole('button', {
        name: 'Admin menu, 1 waiting to be accepted. Accept your membership to finish setup'
      })
    ).toBeTruthy();
  });

  it('shows a footer under the items, outside them, and gives it as the trigger description (#359)', async () => {
    render(NavDropdown, {
      props: {
        title: 'Admin',
        items: ITEMS,
        footer: 'Alt+A switches between a page and its admin view'
      }
    });
    const button = screen.getByRole('button', { name: 'Admin menu' });
    // Heard from the trigger, whether or not the menu is open.
    expect(button.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Alt+A switches between a page and its admin view'
    );

    await fireEvent.keyDown(button, { key: 'Enter' });
    await tick();
    // Seen under the items, and not one of them: the arrow keys pass it by.
    expect(screen.getAllByRole('menuitem')).toHaveLength(ITEMS.length);
    expect(screen.getByRole('menu').textContent).toContain(
      'Alt+A switches between a page and its admin view'
    );
  });

  it('says the count in words: the trigger "new" by default, an item in badgeLabel', async () => {
    render(NavDropdown, {
      props: {
        title: 'Admin',
        items: [{ ...ITEMS[0], badge: 2 }],
        badgeLabel: 'waiting to be accepted'
      }
    });
    const button = screen.getByRole('button', { name: 'Admin menu, 2 waiting to be accepted' });
    await fireEvent.keyDown(button, { key: 'Enter' });
    await tick();
    expect(screen.getByRole('menuitem').textContent).toContain('2 waiting to be accepted');
    cleanup();

    render(NavDropdown, { props: { title: 'Mine', items: [{ ...ITEMS[0], badge: 3 }] } });
    expect(screen.getByRole('button', { name: 'Mine menu, 3 new' })).toBeTruthy();
  });

  it('has no aria-keyshortcuts: Alt+A does not open a menu (#411 review)', () => {
    mount();
    expect(trigger().hasAttribute('aria-keyshortcuts')).toBe(false);
  });

  it('is closed at first, and names no panel in aria-controls while closed', () => {
    mount();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().getAttribute('aria-controls')).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it.each([['Enter'], [' '], ['ArrowDown']])(
    '%j on the trigger opens the menu and focuses the first item',
    async (key) => {
      mount();
      await fireEvent.keyDown(trigger(), { key });
      await tick();
      expect(trigger().getAttribute('aria-expanded')).toBe('true');
      expect(trigger().getAttribute('aria-controls')).toBe(screen.getByRole('menu').id);
      expect(document.activeElement).toBe(item('Alpha'));
    }
  );

  it('ArrowUp on the trigger opens the menu and focuses the last item', async () => {
    mount();
    await fireEvent.keyDown(trigger(), { key: 'ArrowUp' });
    await tick();
    expect(document.activeElement).toBe(item('Gamma'));
  });

  it('Escape on an item closes the menu and returns focus to the trigger', async () => {
    mount();
    await fireEvent.keyDown(trigger(), { key: 'Enter' });
    await tick();
    await fireEvent.keyDown(item('Alpha'), { key: 'Escape' });
    await tick();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('focus leaving the menu (Tab past the last item) closes it', async () => {
    const { container } = mount();
    const outside = document.createElement('button');
    container.appendChild(outside);
    await fireEvent.keyDown(trigger(), { key: 'Enter' });
    await tick();
    await fireEvent.focusOut(item('Alpha'), { relatedTarget: outside });
    await tick();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('the pointer leaving does not close a menu a keyboard user is inside', async () => {
    const { container } = mount();
    const wrapper = container.querySelector('[role="presentation"]')!;
    await fireEvent.keyDown(trigger(), { key: 'Enter' });
    await tick();
    expect(document.activeElement).toBe(item('Alpha'));
    await fireEvent.mouseLeave(wrapper);
    await tick();
    expect(screen.getByRole('menu'), 'still open').toBeTruthy();
  });

  it('but does close a menu that was only hovered', async () => {
    const { container } = mount();
    const wrapper = container.querySelector('[role="presentation"]')!;
    await fireEvent.mouseEnter(wrapper);
    await tick();
    expect(screen.getByRole('menu')).toBeTruthy();
    await fireEvent.mouseLeave(wrapper);
    await tick();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  // From Sacha's review of #352: each of these fails on a change to the component
  // that left the cases above green.
  it('ArrowDown on an item moves focus to the next', async () => {
    mount();
    await fireEvent.keyDown(trigger(), { key: 'Enter' });
    await tick();
    await fireEvent.keyDown(item('Alpha'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('Beta'));
  });

  it('a pointer click opens, and a second one does not close', async () => {
    mount();
    await fireEvent.click(trigger(), { detail: 1 });
    expect(screen.getByRole('menu')).toBeTruthy();
    await fireEvent.click(trigger(), { detail: 1 });
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('a click with no key press (detail 0, as a screen reader sends) opens on the first item', async () => {
    mount();
    await fireEvent.click(trigger(), { detail: 0 });
    await tick();
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(document.activeElement).toBe(item('Alpha'));
  });

  it('a click on an item closes the menu', async () => {
    mount();
    await fireEvent.keyDown(trigger(), { key: 'Enter' });
    await tick();
    item('Alpha').addEventListener('click', (e) => e.preventDefault());
    await fireEvent.click(item('Alpha'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Escape on the trigger of a hovered menu closes it', async () => {
    const { container } = mount();
    await fireEvent.mouseEnter(container.querySelector('[role="presentation"]')!);
    expect(screen.getByRole('menu')).toBeTruthy();
    await fireEvent.keyDown(trigger(), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('a hovered menu closes when the pointer leaves, even after a middle click on an item', async () => {
    const { container } = mount();
    const wrapper = container.querySelector('[role="presentation"]')!;
    await fireEvent.mouseEnter(wrapper);
    item('Alpha').focus();
    await fireEvent(item('Alpha'), new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    await fireEvent.mouseLeave(wrapper);
    await tick();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('a pointer click after a keyboard open hands the menu back to the pointer', async () => {
    const { container } = mount();
    const wrapper = container.querySelector('[role="presentation"]')!;
    await fireEvent.keyDown(trigger(), { key: 'Enter' });
    await tick();
    await fireEvent.mouseEnter(wrapper);
    await fireEvent.click(trigger(), { detail: 1 });
    await fireEvent.mouseLeave(wrapper);
    await tick();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
