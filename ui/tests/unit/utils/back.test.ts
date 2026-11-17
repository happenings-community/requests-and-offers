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

  it("goes to the fallback when coming back from the listing's own edit form (#349 review)", () => {
    // Edit, then Save or Cancel, lands on the listing with the edit form behind it;
    // Back went to the form, and Back and Cancel could alternate between the two.
    const here = new URL('http://localhost/offers/abc');
    expect(backTarget(new URL('http://localhost/offers/abc/edit'), '/offers', here)).toBe(
      '/offers'
    );
    expect(
      backTarget(
        new URL('http://localhost/offers/abc/edit'),
        '/offers',
        new URL('http://localhost/offers/abc/')
      )
    ).toBe('/offers');
  });

  it('still goes through history from anywhere else, another edit form included', () => {
    const here = new URL('http://localhost/offers/abc');
    expect(backTarget(new URL('http://localhost/offers/xyz/edit'), '/offers', here)).toBe(
      'history'
    );
    expect(backTarget(new URL('http://localhost/my-listings'), '/offers', here)).toBe('history');
    expect(backTarget(null, '/offers', here)).toBe('/offers');
  });
});
