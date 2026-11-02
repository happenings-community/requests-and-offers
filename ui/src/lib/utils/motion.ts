import type { TransitionConfig } from 'svelte/transition';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * True when the visitor has asked their system for reduced motion.
 *
 * Read at the moment it is called, so a change of setting applies to the next
 * transition without a reload. Outside a browser (SSR, or a test environment
 * without `matchMedia`) it reports false, which leaves motion as it was.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Wraps a Svelte transition so that it runs with a duration of 0 when reduced
 * motion is preferred, and unchanged otherwise.
 *
 * The global `prefers-reduced-motion` rule in `app.postcss` shortens CSS
 * animations, but Svelte still waits for a transition's own duration before it
 * removes an outroing element. Setting the duration here keeps the two in step.
 *
 * Usage: `const slide = reducedMotion(svelteSlide);` then `transition:slide`.
 */
export function reducedMotion<P extends object | undefined>(
  transition: (node: Element, params?: P) => TransitionConfig
): (node: Element, params?: P) => TransitionConfig {
  return (node, params) => (prefersReducedMotion() ? { duration: 0 } : transition(node, params));
}
