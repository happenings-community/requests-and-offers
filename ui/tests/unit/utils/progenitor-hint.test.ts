import { describe, expect, it } from 'vitest';
import { needsSelfAcceptance } from '$lib/utils/progenitor-hint';

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
