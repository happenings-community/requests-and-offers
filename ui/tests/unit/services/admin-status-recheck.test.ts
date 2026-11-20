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
  it('UserForm.svelte re-checks admin status and re-reads the profile on both create paths', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const form = readFileSync(
      resolve(__dirname, '../../../src/lib/components/users/UserForm.svelte'),
      'utf8'
    );
    // Both create paths go through one helper, which does both reads.
    expect(form.match(/await refreshAfterCreate\(\)/g)?.length).toBe(2);
    const helper = form.slice(form.indexOf('async function refreshAfterCreate'));
    const body = helper.slice(0, helper.indexOf('\n  }\n') + 4);
    expect(body).toContain('await recheckAdminStatusNow()');
    expect(body).toContain('usersStore.refreshCurrentUser()');
  });
});

describe('a re-check keeps the last answer while it asks again', () => {
  // The admin area shows its pages only on an answer. A re-check that showed as
  // 'checking' swapped every admin page for a spinner once a minute and rebuilt it,
  // losing what was typed and re-reading every list.
  const fresh = async () => {
    vi.resetModules();
    return import('$lib/services/adminStatus.service.svelte');
  };
  const checkedBy = (service: Awaited<ReturnType<typeof fresh>>) =>
    E.runPromise(
      E.provide(
        E.flatMap(service.AdminStatusServiceTag, (s) => s.ensureAdminStatusChecked()),
        service.AdminStatusServiceLive
      )
    );
  // Past the 30 seconds a fresh answer is reused for.
  const aMinuteLater = () => vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);

  beforeEach(() => {
    check.mockReset();
    vi.restoreAllMocks();
  });

  it('shows checking on the first check, before there is any answer', async () => {
    const service = await fresh();
    let answer: (isAdmin: boolean) => void = () => {};
    check.mockReturnValue(E.promise(() => new Promise<boolean>((r) => (answer = r))));
    const first = checkedBy(service);
    await new Promise((r) => setTimeout(r, 0));
    expect(service.useAdminStatusCheck().adminStatusState).toBe('checking');
    answer(true);
    await first;
    expect(service.useAdminStatusCheck().adminStatusState).toBe('admin');
  });

  it('keeps an administrator an administrator while the minute re-check asks again', async () => {
    const service = await fresh();
    check.mockReturnValue(E.succeed(true));
    await checkedBy(service);

    aMinuteLater();
    let answer: (isAdmin: boolean) => void = () => {};
    check.mockReturnValue(E.promise(() => new Promise<boolean>((r) => (answer = r))));
    const recheck = checkedBy(service);
    await new Promise((r) => setTimeout(r, 0));
    expect(service.useAdminStatusCheck().adminStatusState).toBe('admin');
    answer(true);
    await recheck;
    expect(service.useAdminStatusCheck().adminStatusState).toBe('admin');
  });

  it('keeps the last answer when a re-check fails', async () => {
    const service = await fresh();
    check.mockReturnValue(E.succeed(true));
    await checkedBy(service);

    aMinuteLater();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    check.mockReturnValue(E.fail(new Error('conductor away')));
    await checkedBy(service).catch(() => {});
    expect(service.useAdminStatusCheck().adminStatusState).toBe('admin');
  });

  it('still records an error when the first check fails', async () => {
    const service = await fresh();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    check.mockReturnValue(E.fail(new Error('conductor away')));
    await checkedBy(service).catch(() => {});
    expect(service.useAdminStatusCheck().adminStatusState).toBe('error');
  });
});
