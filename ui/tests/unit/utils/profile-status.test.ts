import { describe, it, expect } from 'vitest';

import { headingFor, isBlockedState, lineFor, statusLabel } from '$lib/utils/profile-status';

describe('headingFor', () => {
  it('names the status, never a missing profile', () => {
    expect(headingFor('pending')).toBe('Your application is waiting for approval');
    expect(headingFor('rejected')).toBe("Your application wasn't accepted");
    expect(headingFor('suspended_temporarily')).toBe('Your profile is suspended');
  });

  it('calls an indefinite suspension permanent', () => {
    expect(headingFor('suspended_indefinitely')).toBe('Your profile is permanently suspended');
  });
});

describe('lineFor', () => {
  it("says what the page blocks, in the page's words", () => {
    expect(lineFor('pending', 'create requests')).toBe(
      "You can't create requests until an administrator approves your profile."
    );
    expect(lineFor('rejected', 'view or create offers')).toBe("You can't view or create offers.");
    expect(lineFor('suspended_indefinitely', 'create offers')).toBe("You can't create offers.");
  });

  it('gives the end of a temporary suspension when it is known', () => {
    // A Holochain timestamp, in microseconds.
    const line = lineFor(
      'suspended_temporarily',
      'create requests',
      Date.UTC(2026, 10, 5, 12) * 1000
    );
    expect(line).toMatch(/^You can't create requests while your profile is suspended\. /);
    expect(line).toMatch(/Your suspension ends on .*2026\.$/);
  });

  it('leaves the end out when there is none, or it is not a number', () => {
    const base = "You can't create requests while your profile is suspended.";
    expect(lineFor('suspended_temporarily', 'create requests')).toBe(base);
    expect(lineFor('suspended_temporarily', 'create requests', null)).toBe(base);
    expect(lineFor('suspended_temporarily', 'create requests', Number.NaN)).toBe(base);
  });
});

describe('statusLabel', () => {
  it('turns the stored status into a label', () => {
    expect(statusLabel('pending')).toBe('Pending');
    expect(statusLabel('accepted')).toBe('Accepted');
    expect(statusLabel('rejected')).toBe('Rejected');
    expect(statusLabel('suspended temporarily')).toBe('Suspended (temporary)');
    expect(statusLabel('suspended indefinitely')).toBe('Suspended (permanent)');
  });

  it('says Unknown for anything else', () => {
    expect(statusLabel(undefined)).toBe('Unknown');
    expect(statusLabel('bogus')).toBe('Unknown');
  });
});

describe('isBlockedState', () => {
  it('covers the four states with a profile that is not accepted', () => {
    for (const s of ['pending', 'rejected', 'suspended_temporarily', 'suspended_indefinitely']) {
      expect(isBlockedState(s)).toBe(true);
    }
    for (const s of ['missing', 'accepted', 'error', 'unknown', 'loading']) {
      expect(isBlockedState(s)).toBe(false);
    }
  });
});
