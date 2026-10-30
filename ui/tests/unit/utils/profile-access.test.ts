import { describe, it, expect } from 'vitest';

import { canBrowseFor, isOpenToAll } from '$lib/utils/profile-access';

describe('canBrowseFor', () => {
  it('lets an accepted member browse', () => {
    expect(canBrowseFor('accepted')).toBe(true);
  });

  // #335: pending used to browse; it now gets the same blocked view as rejected.
  it('blocks pending, rejected, suspended and profile-less members alike', () => {
    for (const state of [
      'pending',
      'rejected',
      'suspended_temporarily',
      'suspended_indefinitely',
      'missing',
      'loading'
    ]) {
      expect(canBrowseFor(state)).toBe(false);
    }
  });

  it('keeps the error and unknown fallback so a fault never locks a member out', () => {
    expect(canBrowseFor('error')).toBe(true);
    expect(canBrowseFor('unknown')).toBe(true);
  });
});

describe('isOpenToAll', () => {
  it('keeps a member own profile pages open at every status', () => {
    expect(isOpenToAll('/user')).toBe(true);
    expect(isOpenToAll('/user/create')).toBe(true);
    expect(isOpenToAll('/user/edit')).toBe(true);
    expect(isOpenToAll('/user/')).toBe(true);
  });

  it('guards every page that shows members, organisations or listings', () => {
    for (const path of [
      '/users',
      '/users/abc',
      '/offers',
      '/offers/abc',
      '/requests',
      '/organizations',
      '/exchanges',
      '/my-listings',
      '/service-types',
      '/tags/gardening'
    ]) {
      expect(isOpenToAll(path)).toBe(false);
    }
  });
});
