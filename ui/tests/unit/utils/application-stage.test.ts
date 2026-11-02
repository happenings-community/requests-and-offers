import { describe, it, expect } from 'vitest';

import { applicationStage } from '$lib/utils/application-stage';

const REQUESTED_AT = 1_760_000_000_000;

describe('applicationStage (#331)', () => {
  it('is a new application while pending with no request', () => {
    expect(applicationStage({ status_type: 'pending' }, REQUESTED_AT)).toBe('new');
    expect(applicationStage({ status_type: 'pending', reason: '   ' }, REQUESTED_AT)).toBe('new');
  });

  it('is waiting when the profile has not changed since the request', () => {
    const status = { status_type: 'pending', reason: 'Add a bio', created_at: REQUESTED_AT };
    expect(applicationStage(status, REQUESTED_AT - 60_000)).toBe('waiting');
    expect(applicationStage(status, REQUESTED_AT)).toBe('waiting');
  });

  it('is responded when the profile was edited after the request', () => {
    const status = { status_type: 'pending', reason: 'Add a bio', created_at: REQUESTED_AT };
    expect(applicationStage(status, REQUESTED_AT + 1)).toBe('responded');
  });

  it('is waiting when either time is unknown, rather than guessing', () => {
    expect(applicationStage({ status_type: 'pending', reason: 'Add a bio' }, REQUESTED_AT)).toBe(
      'waiting'
    );
    expect(
      applicationStage(
        { status_type: 'pending', reason: 'Add a bio', created_at: REQUESTED_AT },
        null
      )
    ).toBe('waiting');
  });

  it('is nothing for anyone who is not pending', () => {
    for (const status_type of ['accepted', 'rejected', 'suspended temporarily']) {
      expect(applicationStage({ status_type, reason: 'x', created_at: 1 }, 2)).toBeNull();
    }
    expect(applicationStage(undefined, REQUESTED_AT)).toBeNull();
  });
});
