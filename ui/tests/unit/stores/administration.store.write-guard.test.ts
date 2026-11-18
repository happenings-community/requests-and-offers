import { describe, it, expect, vi } from 'vitest';
import { Effect as E } from 'effect';
import { encode } from '@msgpack/msgpack';
import type { Record as HcRecord } from '@holochain/client';
import { CacheServiceLive } from '$lib/utils/cache.svelte';
import {
  HolochainClientServiceTag,
  type HolochainClientService
} from '$lib/services/HolochainClientService.svelte';
import {
  AdministrationServiceTag,
  type AdministrationService
} from '$lib/services/zomes/administration.service';

/**
 * **A background refresh never undoes a status write on screen** (#340's rule, #411).
 *
 * The Admin menu re-reads every member once a minute. If an administrator accepts a member
 * while one of those reads is on its way, the read answers with the member as they were
 * before, and applying it would show them pending again until the next tick. The write
 * guard drops that answer; this test holds the wiring, which a test of the guard alone
 * does not: remove `listsGuard.wrote()` from `updateUserStatus` and it goes red.
 */

const memberHash = new Uint8Array(39).fill(5);
const member = (status_type: string) => ({
  name: 'Pat Member',
  original_action_hash: memberHash,
  status: { status_type }
});

// The administration store reads each member through the users store, imported at module
// level: stood in for, answering with the member as the DHT had them before the write.
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: { getLatestUser: vi.fn(() => E.succeed(member('pending'))) }
}));
const orgHash = new Uint8Array(39).fill(6);
vi.mock('$lib/stores/organizations.store.svelte', () => ({
  default: {
    getLatestOrganization: vi.fn(() =>
      E.succeed({
        name: 'Pat Co',
        original_action_hash: orgHash,
        status: { status_type: 'pending' }
      })
    )
  }
}));

import { createAdministrationStore } from '$lib/stores/administration.store.svelte';

// The write's time is 0, so the store's memory of a recent write (57c262a4) gives way to any
// read, and the write guard alone holds the written status: these cases test the guard.
const statusRecord = (status_type: string) =>
  ({
    signed_action: {
      hashed: {
        hash: new Uint8Array(39).fill(9),
        content: { header: { timestamp: 0 }, data: { type: 'Update' } }
      }
    },
    entry: { Present: { entry: encode({ status_type, created_at: 1, updated_at: 1 }) } }
  }) as unknown as HcRecord;

describe('the Admin menu refresh and a status write', () => {
  it('keeps an accepted member accepted when an older read answers after the write', async () => {
    let releaseRead: () => void = () => {};
    let holdNextRead = false;
    const service = {
      getAllUsersLinks: vi.fn(() =>
        E.promise(
          () =>
            new Promise<unknown[]>((resolve) => {
              const answer = () => resolve([{ target: memberHash }]);
              if (holdNextRead) releaseRead = answer;
              else answer();
            })
        )
      ),
      getAllOrganizationsLinks: vi.fn(() => E.succeed([{ target: orgHash }])),
      updateEntityStatus: vi.fn(() => E.succeed(statusRecord('accepted')))
    } as unknown as AdministrationService;

    const store = await E.runPromise(
      createAdministrationStore().pipe(
        E.provideService(AdministrationServiceTag, service),
        E.provide(CacheServiceLive),
        E.provideService(HolochainClientServiceTag, {} as HolochainClientService)
      )
    );

    // A first refresh lists the member as pending.
    await E.runPromise(store.refreshLists());
    expect(store.allUsers[0]?.status?.status_type).toBe('pending');

    // The next refresh is on its way when the administrator accepts the member.
    holdNextRead = true;
    const tick = E.runPromise(store.refreshLists());
    await E.runPromise(
      store.updateUserStatus(memberHash, memberHash, memberHash, {
        status_type: 'accepted'
      } as never)
    );
    expect(store.allUsers[0]?.status?.status_type).toBe('accepted');

    // Its answer, from before the write, arrives and is dropped.
    releaseRead();
    await tick;
    expect(store.allUsers[0]?.status?.status_type).toBe('accepted');
  });

  it('keeps an accepted organization accepted when an older read answers after the write', async () => {
    let releaseRead: () => void = () => {};
    let holdNextRead = false;
    const service = {
      getAllUsersLinks: vi.fn(() => E.succeed([])),
      getAllOrganizationsLinks: vi.fn(() =>
        E.promise(
          () =>
            new Promise<unknown[]>((resolve) => {
              const answer = () => resolve([{ target: orgHash }]);
              if (holdNextRead) releaseRead = answer;
              else answer();
            })
        )
      ),
      updateEntityStatus: vi.fn(() => E.succeed(statusRecord('accepted')))
    } as unknown as AdministrationService;

    const store = await E.runPromise(
      createAdministrationStore().pipe(
        E.provideService(AdministrationServiceTag, service),
        E.provide(CacheServiceLive),
        E.provideService(HolochainClientServiceTag, {} as HolochainClientService)
      )
    );

    await E.runPromise(store.refreshLists());
    expect(store.allOrganizations[0]?.status?.status_type).toBe('pending');

    holdNextRead = true;
    const tick = E.runPromise(store.refreshLists());
    await E.runPromise(
      store.updateOrganizationStatus(orgHash, orgHash, orgHash, {
        status_type: 'accepted'
      } as never)
    );
    expect(store.allOrganizations[0]?.status?.status_type).toBe('accepted');

    releaseRead();
    await tick;
    expect(store.allOrganizations[0]?.status?.status_type).toBe('accepted');
  });
});
