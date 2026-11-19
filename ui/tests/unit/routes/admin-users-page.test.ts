import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import { flushSync, tick } from 'svelte';
import { Effect as E } from 'effect';
import type { UIUser } from '$lib/types/ui';

/**
 * The admin Users page moves a member between its lists as soon as a status is written, and
 * Retry Loading loads again after a failed load.
 *
 * Accepting a member dropped the Admin menu's count at once, but the page kept the member
 * under Pending until it was drawn again (walk of 18 November): its list was a copy the
 * store's in-place updates never reached. And Retry Loading started a load it never ran,
 * which an effect clearing the loading flag had hidden.
 */

const fetchCalls = { count: 0, failFirst: false };

vi.mock('$lib/stores/administration.store.svelte', async () => {
  const { admin } = await import('../../mocks/reactive-admin.svelte');
  return {
    default: {
      get allUsers() {
        return admin.allUsers;
      },
      // As the real store: the fetched members go into allUsers, after a wait.
      fetchAllUsers: () =>
        E.tryPromise({
          try: async () => {
            fetchCalls.count += 1;
            await new Promise((resolve) => setTimeout(resolve, 0));
            if (fetchCalls.failFirst && fetchCalls.count === 1) throw new Error('No network');
            const fetched = admin.allUsers.map((u) => ({ ...u }));
            admin.allUsers.splice(0, admin.allUsers.length, ...fetched);
            return fetched;
          },
          catch: (e) => e as Error
        })
    }
  };
});
vi.mock('$lib/utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  showToast: vi.fn()
}));
vi.mock('$lib/components/users/UsersTable.svelte', async () => ({
  default: (await import('../../mocks/Empty.svelte')).default
}));

const { admin } = await import('../../mocks/reactive-admin.svelte');
const { default: AdminUsersPage } = await import('../../../src/routes/admin/users/+page.svelte');

const user = (name: string, status: string) =>
  ({
    name,
    original_action_hash: new Uint8Array(39).fill(name.charCodeAt(0)),
    status: { status_type: status }
  }) as unknown as UIUser;

/** What the store does when an administrator writes a status: the array changed in place. */
const writeStatus = (name: string, status: string) => {
  const next = admin.allUsers.map((u) =>
    u.name === name ? ({ ...u, status: { ...u.status, status_type: status } } as UIUser) : u
  );
  admin.allUsers.splice(0, admin.allUsers.length, ...next);
};

const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await tick();
  }
  flushSync();
};

const heading = (title: string) => screen.getByText(new RegExp(`^${title} \\(\\d+\\)$`));

beforeEach(() => {
  cleanup();
  fetchCalls.count = 0;
  fetchCalls.failFirst = false;
  admin.allUsers.splice(
    0,
    admin.allUsers.length,
    user('Alice', 'accepted'),
    user('Bob', 'pending')
  );
});

describe('the admin Users page', () => {
  it('moves an accepted member out of Pending at once', async () => {
    render(AdminUsersPage);
    await settle();
    expect(heading('Pending Users').textContent).toBe('Pending Users (1)');
    expect(heading('Accepted Users').textContent).toBe('Accepted Users (1)');

    writeStatus('Bob', 'accepted');
    await settle();

    expect(heading('Pending Users').textContent).toBe('Pending Users (0)');
    expect(heading('Accepted Users').textContent).toBe('Accepted Users (2)');
  });

  it('loads again when Retry Loading is pressed after a failed load', async () => {
    fetchCalls.failFirst = true;
    render(AdminUsersPage);
    await settle();
    expect(screen.getByText('No network')).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Retry Loading' }));
    await settle();

    expect(fetchCalls.count).toBe(2);
    expect(screen.queryByText('Loading users...')).toBeNull();
    expect(heading('Pending Users').textContent).toBe('Pending Users (1)');
  });
});
