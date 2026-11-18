/**
 * A stand-in a page can bind to. A plain object in a mock is not reactive, so a page that
 * binds a control to it warns, and a change made through it never reaches the screen.
 *
 * `factory` hands back the one reactive object, for mocking a `use...()` composable.
 */
export function reactive<T extends object>(initial: T): { value: T; factory: () => T } {
  const value = $state(initial);
  return { value, factory: () => value };
}
