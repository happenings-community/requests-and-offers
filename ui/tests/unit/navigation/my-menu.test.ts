import { describe, it, expect } from 'vitest';
import { myActivityItems, myMenuItems, myProfileItems } from '$lib/navigation/my-menu';

describe('the member’s own menus (#344)', () => {
  it('puts listings and exchanges under My Activity, with no separate requests or offers', () => {
    expect(myActivityItems().map((i) => i.label)).toEqual(['My Listings', 'My Exchanges']);
    expect(myActivityItems().some((i) => i.href.includes('filter=my'))).toBe(false);
  });

  it('puts your profile under your picture, or Create Profile until there is one', () => {
    expect(myProfileItems(true).map((i) => i.label)).toEqual(['My Profile']);
    expect(myProfileItems(false)[0]).toMatchObject({
      label: 'Create Profile',
      href: '/user/create'
    });
  });

  it('gives the home page all three, profile first', () => {
    expect(myMenuItems(true).map((i) => i.label)).toEqual([
      'My Profile',
      'My Listings',
      'My Exchanges'
    ]);
  });
});
