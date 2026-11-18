import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import { Effect as E } from 'effect';
import type { UIUser } from '$lib/types/ui';

/**
 * The admin Users page follows the store after a status is written (walk of 18 November).
 * Accepting a member dropped the Admin menu's count at once, but the page kept the member
 * under Pending until it was drawn again: its list was the array the first load returned,
 * which the store's later in-place updates never reached.
 */

vi.mock('$lib/stores/administration.store.svelte', async () => {
  const { admin } = await import('../../../mocks/reactive-admin.svelte');
  return {
    default: {
      get allUsers() {
        return admin.allUsers;
      },
      // As the real store: it reads the network, then puts the fetched members into
      // allUsers and returns its own array of them.
      fetchAllUsers: () =>
        E.promise(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
          const fetched = admin.allUsers.map((u) => ({ ...u }));
          admin.allUsers.splice(0, admin.allUsers.length, ...fetched);
          return fetched;
        })
    }
  };
});
vi.mock('$lib/utils', () => ({ showToast: vi.fn() }));

const { admin } = await import('../../../mocks/reactive-admin.svelte');
const { useUsersManagement } = await import(
  '$lib/composables/domain/users/useUsersManagement.svelte'
);

const user = (name: string, status: string) =>
  ({
    name,
    original_action_hash: new Uint8Array(39).fill(name.charCodeAt(0)),
    status: { status_type: status }
  }) as unknown as UIUser;

/** What the store does when an administrator writes a status: the array changed in place. */
const writeStatus = (name: string, status: string) => {
  const i = admin.allUsers.findIndex((u) => u.name === name);
  const next = [...admin.allUsers];
  next[i] = { ...next[i], status: { ...next[i].status, status_type: status } } as UIUser;
  admin.allUsers.splice(0, admin.allUsers.length, ...next);
};

let stop: () => void = () => {};
afterEach(() => stop());
beforeEach(() => {
  admin.allUsers.splice(
    0,
    admin.allUsers.length,
    user('Alice', 'accepted'),
    user('Bob', 'pending')
  );
});

describe('useUsersManagement', () => {
  it('follows a status written after the first load, without drawing the page again', async () => {
    let management!: ReturnType<typeof useUsersManagement>;
    stop = $effect.root(() => {
      management = useUsersManagement();
    });
    flushSync();
    // The page loads on mount; the store changes after.
    await E.runPromise(management.loadUsers());
    flushSync();
    expect(management.users.find((u) => u.name === 'Bob')?.status?.status_type).toBe('pending');

    writeStatus('Bob', 'accepted');
    flushSync();

    expect(management.users.find((u) => u.name === 'Bob')?.status?.status_type).toBe('accepted');
  });

  it('still narrows to one status when asked to', async () => {
    let management!: ReturnType<typeof useUsersManagement>;
    stop = $effect.root(() => {
      management = useUsersManagement({ filter: 'pending' });
    });
    flushSync();
    await E.runPromise(management.loadUsers());
    flushSync();
    expect(management.users.map((u) => u.name)).toEqual(['Bob']);

    writeStatus('Bob', 'accepted');
    flushSync();

    expect(management.users).toEqual([]);
  });
});
