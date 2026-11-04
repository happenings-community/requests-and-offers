import { describe, it, expect } from 'vitest';
import { menuKeyTarget } from '$lib/utils/menu-keys';

describe('menuKeyTarget (#204)', () => {
  it('enters the menu from the trigger: down to the first item, up to the last', () => {
    expect(menuKeyTarget('ArrowDown', -1, 3)).toBe(0);
    expect(menuKeyTarget('ArrowUp', -1, 3)).toBe(2);
  });

  it('moves between items and wraps at either end', () => {
    expect(menuKeyTarget('ArrowDown', 0, 3)).toBe(1);
    expect(menuKeyTarget('ArrowDown', 2, 3)).toBe(0);
    expect(menuKeyTarget('ArrowUp', 0, 3)).toBe(2);
  });

  it('jumps to the first and last items with Home and End', () => {
    expect(menuKeyTarget('Home', 2, 3)).toBe(0);
    expect(menuKeyTarget('End', 0, 3)).toBe(2);
  });

  it('leaves other keys alone, and an empty menu', () => {
    expect(menuKeyTarget('a', 0, 3)).toBeNull();
    expect(menuKeyTarget('ArrowDown', -1, 0)).toBeNull();
  });
});
