import { describe, it, expect } from 'vitest';
import { backTarget } from '$lib/utils/back';

describe('backTarget', () => {
  it('goes back through history when the member came from a screen in the app', () => {
    expect(backTarget(new URL('http://localhost/my-listings'), '/offers')).toBe('history');
  });

  it('goes to the fallback when the page was the first one loaded', () => {
    expect(backTarget(null, '/offers')).toBe('/offers');
    expect(backTarget(undefined, '/requests')).toBe('/requests');
  });
});
