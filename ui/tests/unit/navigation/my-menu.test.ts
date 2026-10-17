import { describe, it, expect } from 'vitest';
import { myMenuItems } from '$lib/navigation/my-menu';

describe('myMenuItems (#344)', () => {
  it('lists profile, listings and exchanges, and no separate requests or offers', () => {
    expect(myMenuItems(true).map((i) => i.label)).toEqual([
      'My Profile',
      'My Listings',
      'My Exchanges'
    ]);
    expect(myMenuItems(true).some((i) => i.href.includes('filter=my'))).toBe(false);
  });

  it('offers Create Profile in place of My Profile until there is one', () => {
    expect(myMenuItems(false)[0]).toMatchObject({ label: 'Create Profile', href: '/user/create' });
  });
});
