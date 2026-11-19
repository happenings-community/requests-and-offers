import { describe, it, expect } from 'vitest';
import { MY_MESSAGES, myActivityItems, myMenuItems, myProfileItems } from '$lib/navigation/my-menu';

describe('the member’s own menus (#344)', () => {
  it('puts listings and exchanges under My Activity, with no separate requests or offers', () => {
    expect(myActivityItems(true).map((i) => i.label)).toEqual(['My Listings', 'My Exchanges']);
    expect(myActivityItems(true).some((i) => i.href.includes('filter=my'))).toBe(false);
  });

  it('puts your profile under your picture, or Create Profile until there is one', () => {
    expect(myProfileItems(true).map((i) => i.label)).toEqual(['My Profile']);
    expect(myProfileItems(false)[0]).toMatchObject({
      label: 'Create Profile',
      href: '/user/create'
    });
  });

  it('gives the home page all three, profile first', () => {
    expect(myMenuItems(true, true).map((i) => i.label)).toEqual([
      'My Profile',
      'My Listings',
      'My Exchanges'
    ]);
  });

  it('keeps My Activity to accepted members, since both pages are members only (#349 review)', () => {
    expect(myActivityItems(false)).toEqual([]);
    expect(myMenuItems(true, false).map((i) => i.label)).toEqual(['My Profile']);
    expect(myMenuItems(false, false).map((i) => i.label)).toEqual(['Create Profile']);
  });

  it('adds My Messages to My Activity where the network has messaging (Sam, 16 November)', () => {
    expect(myActivityItems(true, true).map((i) => i.label)).toEqual([
      'My Listings',
      'My Exchanges',
      'My Messages'
    ]);
    expect(MY_MESSAGES.href).toBe('/messages');
    expect(myMenuItems(true, true, true).map((i) => i.label)).toEqual([
      'My Profile',
      'My Listings',
      'My Exchanges',
      'My Messages'
    ]);
    // A pending member has none of it: Messages is behind the Members only wall too.
    expect(myActivityItems(false, true)).toEqual([]);
  });
});
