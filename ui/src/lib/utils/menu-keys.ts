/**
 * Which menu item a key moves focus to (#204). `current` is -1 when focus is
 * on the trigger. Returns the index to focus, or null when the key does not
 * move focus within the menu.
 */
export function menuKeyTarget(key: string, current: number, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case 'ArrowDown':
      return current < 0 ? 0 : (current + 1) % count;
    case 'ArrowUp':
      return current < 0 ? count - 1 : (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
