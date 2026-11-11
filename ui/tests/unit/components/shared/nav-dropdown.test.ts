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
});
