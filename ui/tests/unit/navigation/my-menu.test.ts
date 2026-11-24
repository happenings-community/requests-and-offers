import { describe, it, expect } from 'vitest';
import { MY_MESSAGES, myActivityItems, myMenuItems, myProfileItems } from '$lib/navigation/my-menu';

describe('the member’s own menus (#344)', () => {
  it('lists listings then exchanges, as the nav bar does, with no separate requests or offers', () => {
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

  it('adds My Messages to My Activity where this network has messaging (R121)', () => {
    expect(myActivityItems(true, true).map((i) => [i.label, i.href])).toEqual([
      ['My Listings', '/my-listings'],
      ['My Exchanges', '/exchanges'],
      ['My Messages', '/messages']
    ]);
    expect(MY_MESSAGES.href).toBe('/messages');
    expect(myActivityItems(true, false).map((i) => i.label)).toEqual([
      'My Listings',
      'My Exchanges'
    ]);
  });

  it('gives the home page all three, profile first', () => {
    expect(myMenuItems(true, true).map((i) => i.label)).toEqual([
      'My Profile',
      'My Listings',
      'My Exchanges'
    ]);
  });

  it('gives the home page My Messages too where there is messaging, so the two lists agree', () => {
    expect(myMenuItems(true, true, true).map((i) => i.label)).toEqual([
      'My Profile',
      'My Listings',
      'My Exchanges',
      'My Messages'
    ]);
  });

  it('keeps My Activity to accepted members, since every page in it is members only (#349 review)', () => {
    expect(myActivityItems(false, true)).toEqual([]);
    expect(myMenuItems(true, false, true).map((i) => i.label)).toEqual(['My Profile']);
    expect(myMenuItems(false, false).map((i) => i.label)).toEqual(['Create Profile']);
  });
});
