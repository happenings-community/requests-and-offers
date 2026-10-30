import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion, reducedMotion } from '$lib/utils/motion';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches, media: query }) as unknown as MediaQueryList)
  );
}

describe('reduced motion helper', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports false when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('reads the prefers-reduced-motion media query', () => {
    stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('runs the transition unchanged when motion is not reduced', () => {
    stubMatchMedia(false);
    const inner = vi.fn(() => ({ duration: 400 }));
    const node = document.createElement('div');
    expect(reducedMotion(inner)(node, { duration: 400 })).toEqual({ duration: 400 });
    expect(inner).toHaveBeenCalledWith(node, { duration: 400 });
  });

  it('gives a duration of 0 when reduced motion is preferred', () => {
    stubMatchMedia(true);
    const inner = vi.fn(() => ({ duration: 400 }));
    expect(reducedMotion(inner)(document.createElement('div'))).toEqual({ duration: 0 });
    expect(inner).not.toHaveBeenCalled();
  });
});
