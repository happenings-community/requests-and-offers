import { describe, it, expect } from 'vitest';
import { adminMenuItems, adminWaiting } from '$lib/navigation/admin-menu';

const withStatus = (status_type?: string) =>
  ({ status: status_type ? { status_type } : undefined }) as never;

describe('admin menu (#359)', () => {
  it('lists every admin page from the sidebar except the Developer ones', () => {
    expect(adminMenuItems({ members: 0, organizations: 0 }).map((i) => i.href)).toEqual([
      '/admin',
      '/admin/users',
      '/admin/organizations',
      '/admin/requests',
      '/admin/offers',
      '/admin/service-types',
      '/admin/mediums-of-exchange',
      '/admin/administrators'
    ]);
  });

  it('counts only pending members and organizations', () => {
    const users = [
      withStatus('pending'),
      withStatus('accepted'),
      withStatus('pending'),
      withStatus()
    ];
    const orgs = [
      withStatus('rejected'),
      withStatus('pending'),
      withStatus('suspended indefinitely')
    ];
    expect(adminWaiting(users, orgs)).toEqual({ members: 2, organizations: 1 });
  });

  it('puts the counts on Members and Organizations only', () => {
    const items = adminMenuItems({ members: 2, organizations: 1 });
    const badges = Object.fromEntries(items.map((i) => [i.href, i.badge]));
    expect(badges['/admin/users']).toBe(2);
    expect(badges['/admin/organizations']).toBe(1);
    expect(items.filter((i) => i.badge !== undefined)).toHaveLength(2);
  });

  it('shows no badge at zero, so the button carries none', () => {
    const items = adminMenuItems({ members: 0, organizations: 0 });
    expect(items.every((i) => i.badge === undefined)).toBe(true);
    expect(items.reduce((n, i) => n + (i.badge ?? 0), 0)).toBe(0);
  });
});
