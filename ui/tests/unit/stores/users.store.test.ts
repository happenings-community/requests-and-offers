import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Effect as E } from 'effect';
import { encode } from '@msgpack/msgpack';
import type { Record as HcRecord } from '@holochain/client';
import { CacheServiceLive } from '$lib/utils/cache.svelte';
import {
  HolochainClientServiceTag,
  type HolochainClientService
} from '$lib/services/HolochainClientService.svelte';
import { UsersServiceTag, type UsersService } from '$lib/services/zomes/users.service';

// The users store reads a member's status through the administration store, imported at
// module level: stood in for before the store is imported.
vi.mock('$lib/stores/administration.store.svelte', () => ({
  default: {
    getLatestStatusForEntity: vi.fn()
  }
}));

import administrationStore from '$lib/stores/administration.store.svelte';
import { createUsersStore, type UsersStore } from '$lib/stores/users.store.svelte';

/**
 * **acceptedUsers holds accepted members only** (#411 review, 15 November).
 *
 * The Admin menu reads every member once a minute through `getLatestUser`, which added
 * whatever it read to `acceptedUsers`, so pending and rejected members joined the
 * directory at /users within a minute of an administrator opening the app.
 */

const hash = new Uint8Array(39).fill(7);

const record = {
  signed_action: {
    hashed: {
      hash,
      content: { header: { timestamp: Date.now() * 1000 }, data: { type: 'Create' } }
    }
  },
  entry: {
    Present: {
      entry: encode({
        name: 'Pat Member',
        nickname: 'pat',
        user_type: 'advocate',
        email: 'p@e.org'
      })
    }
  }
} as unknown as HcRecord;

const usersService = {
  getLatestUserRecord: vi.fn(() => E.succeed(record))
} as unknown as UsersService;

const holochainClient = {
  callZome: vi.fn(),
  waitForConnection: vi.fn(() => Promise.resolve())
} as unknown as HolochainClientService;

describe('getLatestUser and the accepted members list', () => {
  let store: UsersStore;

  beforeEach(async () => {
    store = await E.runPromise(
      createUsersStore().pipe(
        E.provideService(UsersServiceTag, usersService),
        E.provide(CacheServiceLive),
        E.provideService(HolochainClientServiceTag, holochainClient)
      )
    );
  });

  const readAs = (status_type: string) => {
    vi.mocked(administrationStore.getLatestStatusForEntity).mockReturnValue(
      E.succeed({ status_type } as never)
    );
    return E.runPromise(store.getLatestUser(hash));
  };
  const listed = () =>
    store.acceptedUsers.some((u) => u.original_action_hash?.toString() === hash.toString());

  it('does not add a member who is not accepted', async () => {
    const user = await readAs('pending');
    expect(user?.status?.status_type, 'the read still answers').toBe('pending');
    expect(listed()).toBe(false);
  });

  it('adds an accepted member', async () => {
    await readAs('accepted');
    expect(listed()).toBe(true);
  });

  it('takes out a member who has stopped being accepted', async () => {
    await readAs('accepted');
    await readAs('rejected');
    expect(listed()).toBe(false);
  });
});
