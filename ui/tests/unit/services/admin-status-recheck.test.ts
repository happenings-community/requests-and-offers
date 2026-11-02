import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Effect as E } from 'effect';

const check = vi.fn();
vi.mock('$lib/stores/administration.store.svelte', () => ({
  default: { checkIfAgentIsAdministrator: () => check() }
}));

import {
  AdminStatusServiceLive,
  AdminStatusServiceTag,
  recheckAdminStatusNow,
  RECHECK_TIMEOUT_MS,
  useAdminStatusCheck
} from '$lib/services/adminStatus.service.svelte';

const ensureChecked = () =>
  E.runPromise(
    E.provide(
      E.flatMap(AdminStatusServiceTag, (s) => s.ensureAdminStatusChecked()),
      AdminStatusServiceLive
    )
  );

describe('recheckAdminStatusNow (#206)', () => {
  beforeEach(() => check.mockReset());

  it('sees a new admin at once, even with a fresh "non-admin" answer cached', async () => {
    // Before the profile exists: checked, and not an admin.
    check.mockReturnValue(E.succeed(false));
    await ensureChecked();
    expect(useAdminStatusCheck().isAdmin).toBe(false);

    // Creating the profile makes this agent an admin. The cached answer is seconds old.
    check.mockReturnValue(E.succeed(true));
    await recheckAdminStatusNow();
    expect(useAdminStatusCheck().isAdmin).toBe(true);
  });

  it('gives up after a few seconds when the conductor never answers', async () => {
    // The profile form waits on this before its welcome message and redirect,
    // so a check that never returns must not leave a new member on the form.
    vi.useFakeTimers();
    try {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      check.mockReturnValue(E.never);
      let settled = false;
      const recheck = recheckAdminStatusNow().then(() => (settled = true));
      await vi.advanceTimersByTimeAsync(RECHECK_TIMEOUT_MS);
      expect(settled).toBe(true);
      await recheck;
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not throw when the check fails', async () => {
    check.mockReturnValue(E.fail(new Error('conductor away')));
    await expect(recheckAdminStatusNow()).resolves.toBeUndefined();
  });
});

describe('the profile form re-checks after creating a profile', () => {
  it('UserForm.svelte calls recheckAdminStatusNow on both create paths', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const form = readFileSync(
      resolve(__dirname, '../../../src/lib/components/users/UserForm.svelte'),
      'utf8'
    );
    expect(form.match(/await recheckAdminStatusNow\(\)/g)?.length).toBe(2);
  });
});
