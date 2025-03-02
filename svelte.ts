/**
 * Mock implementation of Svelte 5 runes for testing
 */

// Mock $state rune
export const $state = <T>(initialValue: T): T => initialValue;

// Mock $derived rune
export const $derived = <T>(fn: () => T): T => fn();

// Mock $effect rune
export const $effect = (fn: () => void | (() => void)): void => {
  fn();
};

// Mock $derived.by rune
$derived.by = <T>(fn: () => T): T => fn();
