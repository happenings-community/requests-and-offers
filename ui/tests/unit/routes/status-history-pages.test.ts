import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { flushSync, tick } from 'svelte';
import { Effect as E } from 'effect';
import { storeEventBus } from '$lib/stores/storeEvents';

/**
 * The two status-history pages fetch their history in the background and refetch when a status
 * changes. The fetch is a fiber the page owns: leaving the page interrupts it, so a late
 * response cannot write into a page that is gone (#134's class), and a refetch replaces one
 * still in flight instead of racing it.
 *
 * Before, the fetch was forked with `E.runFork`, which nothing could interrupt.
 */

/** One entry per started fetch, in order: `interrupted` flips when its fiber is interrupted. */
const started: Array<{ name: string; interrupted: boolean }> = [];

/** A fetch that never finishes, so the test decides when the page goes away. */
const pendingFetch = (name: string) => {
  const record = { name, interrupted: false };
  started.push(record);
  return E.never.pipe(
    E.onInterrupt(() =>
      E.sync(() => {
        record.interrupted = true;
      })
    )
  );
};

vi.mock('$lib/stores/administration.store.svelte', () => ({
  default: {
    allUsersStatusesHistory: [],
    allOrganizationsStatusesHistory: [],
    fetchAllUsersStatusHistory: () => pendingFetch('users'),
    fetchAllOrganizationsStatusHistory: () => pendingFetch('organizations')
  }
}));
vi.mock('$lib/components/shared/status/StatusTable.svelte', async () => ({
  default: (await import('../../mocks/Empty.svelte')).default
}));

const { default: UsersHistoryPage } = await import(
  '../../../src/routes/admin/users/status-history/+page.svelte'
);
const { default: OrganizationsHistoryPage } = await import(
  '../../../src/routes/admin/organizations/status-history/+page.svelte'
);

const settle = async () => {
  flushSync();
  await tick();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeEach(() => {
  cleanup();
  started.length = 0;
  storeEventBus.clearAll();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

describe('the users status-history page', () => {
  it('starts its fetch on mount and interrupts it when the page goes away', async () => {
    const { unmount } = render(UsersHistoryPage);
    await settle();
    expect(started).toEqual([{ name: 'users', interrupted: false }]);

    unmount();
    await settle();
    expect(started[0].interrupted).toBe(true);
  });

  it('a status change refetches, and the refetch replaces the one in flight', async () => {
    render(UsersHistoryPage);
    await settle();

    storeEventBus.emit('user:status:updated', { user: {} as never });
    await settle();

    expect(started.map((s) => s.name)).toEqual(['users', 'users']);
    expect(started[0].interrupted).toBe(true);
    expect(started[1].interrupted).toBe(false);
  });

  it('keeps the users and organizations fetches apart', async () => {
    render(UsersHistoryPage);
    await settle();

    storeEventBus.emit('organization:status:updated', { organization: {} as never });
    await settle();

    expect(started.map((s) => s.name)).toEqual(['users', 'organizations']);
    // A different history is a different task: the users fetch stays in flight.
    expect(started[0].interrupted).toBe(false);
  });

  it('interrupts both fetches when the page goes away', async () => {
    const { unmount } = render(UsersHistoryPage);
    await settle();
    storeEventBus.emit('organization:status:updated', { organization: {} as never });
    await settle();

    unmount();
    await settle();
    expect(started.every((s) => s.interrupted)).toBe(true);
  });
});

describe('the organizations status-history page', () => {
  it('starts its fetch on mount and interrupts it when the page goes away', async () => {
    const { unmount } = render(OrganizationsHistoryPage);
    await settle();
    expect(started).toEqual([{ name: 'organizations', interrupted: false }]);

    unmount();
    await settle();
    expect(started[0].interrupted).toBe(true);
  });

  it('a status change refetches, and the refetch replaces the one in flight', async () => {
    render(OrganizationsHistoryPage);
    await settle();

    storeEventBus.emit('organization:status:updated', { organization: {} as never });
    await settle();

    expect(started.map((s) => s.name)).toEqual(['organizations', 'organizations']);
    expect(started[0].interrupted).toBe(true);
    expect(started[1].interrupted).toBe(false);
  });
});
