import { describe, expect, it } from 'vitest';
import { needsSelfAcceptance, pendingWall, SELF_ACCEPTANCE_STEP } from '$lib/utils/progenitor-hint';

describe('needsSelfAcceptance', () => {
  it('shows for an administrator whose own status is pending', () => {
    expect(needsSelfAcceptance(true, 'pending')).toBe(true);
  });

  it('does not show once the administrator is accepted', () => {
    expect(needsSelfAcceptance(true, 'accepted')).toBe(false);
  });

  it('does not show for a pending member who is not an administrator', () => {
    expect(needsSelfAcceptance(false, 'pending')).toBe(false);
  });

  it('does not show while the status is not yet known', () => {
    expect(needsSelfAcceptance(true, undefined)).toBe(false);
  });

  it('does not show for other statuses', () => {
    for (const status of [
      'rejected',
      'archived',
      'suspended temporarily',
      'suspended indefinitely'
    ] as const) {
      expect(needsSelfAcceptance(true, status)).toBe(false);
    }
  });
});

/**
 * **The first administrator's pending wall tells them to accept themselves** (dogfooding of
 * 21 November, F14). The only administrator was told "This typically takes 24-48 hours" and
 * offered "Contact the administrators", that is, themselves.
 */
describe('pendingWall', () => {
  it('tells a pending administrator to accept their own membership, in the welcome dialog words', () => {
    const wall = pendingWall(true, 'create offers');
    expect(wall.line).toBe("You can't create offers until you accept your own membership.");
    expect(wall.next).toBe(SELF_ACCEPTANCE_STEP);
    expect(wall.next).not.toMatch(/24-48|under review by administrators/);
    expect(wall.action).toEqual({ label: 'Open the members page', href: '/admin/users' });
  });

  it('keeps the review wording and the contact action for a pending member', () => {
    const wall = pendingWall(false, 'create offers');
    expect(wall.line).toBe("You can't create offers until an administrator approves your profile.");
    expect(wall.next).toMatch(/under review by administrators/);
    expect(wall.action).toEqual({ label: 'Contact the administrators', href: null });
  });
});
