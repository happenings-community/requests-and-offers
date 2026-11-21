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
 * **The administrator lists follow the members and the administrators, whatever the load
 * order** (dogfooding of 21 November, F1 and F2).
 *
 * Opened directly, /admin/administrators reads the administrators first and the members
 * second; the Add Administrator dialog then read "No users found" while an accepted member
 * was there. And after an administrator was added, the Network administrators table kept
 * its old rows until a reload.
 */

const aliceHash = new Uint8Array(39).fill(1);
const bobHash = new Uint8Array(39).fill(2);

vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    getLatestUser: vi.fn((hash: Uint8Array) =>
      E.succeed({
        name: hash[0] === 1 ? 'Alice' : 'Bob',
        original_action_hash: hash,
        status: { status_type: 'accepted', created_at: 1_000 }
      })
    ),
    getUserAgents: vi.fn(() => E.succeed([new Uint8Array(39).fill(7)])),
    getUserByAgentPubKey: vi.fn(() =>
      E.succeed({
        name: 'Alice',
        original_action_hash: new Uint8Array(39).fill(1),
        status: { status_type: 'accepted', created_at: 1_000 }
      })
    )
  }
}));
vi.mock('$lib/stores/organizations.store.svelte', () => ({
  default: { getLatestOrganization: vi.fn(() => E.succeed(null)) }
}));

import { createAdministrationStore } from '$lib/stores/administration.store.svelte';

const acceptedStatusRecord = {
  signed_action: {
    hashed: {
      hash: new Uint8Array(39).fill(9),
      content: { header: { timestamp: 1_000_000 }, data: { type: 'Create' } }
    }
  },
  entry: { Present: { entry: encode({ status_type: 'accepted' }) } }
} as unknown as HcRecord;

const makeStore = () =>
  E.runPromise(
    createAdministrationStore().pipe(
      E.provideService(AdministrationServiceTag, {
        getAllUsersLinks: vi.fn(() => E.succeed([{ target: aliceHash }, { target: bobHash }])),
        getAllOrganizationsLinks: vi.fn(() => E.succeed([])),
        // Alice is the only administrator.
        getAllAdministratorsLinks: vi.fn(() => E.succeed([{ target: aliceHash }])),
        getLatestStatusRecordForEntity: vi.fn(() => E.succeed(acceptedStatusRecord)),
        addAdministrator: vi.fn(() => E.succeed(true)),
        removeAdministrator: vi.fn(() => E.succeed(true))
      } as unknown as AdministrationService),
      E.provide(CacheServiceLive),
      E.provideService(HolochainClientServiceTag, {} as HolochainClientService)
    )
  );

const names = (users: { name: string }[]) => users.map((u) => u.name).sort();

describe('administrators and the members who are not', () => {
  it('lists the accepted non-administrators when the members load after the administrators', async () => {
    const store = await makeStore();
    // A direct load of /admin/administrators: the page reads the administrators, then the
    // dialog reads the members.
    await E.runPromise(store.getAllNetworkAdministrators());
    await E.runPromise(store.fetchAllUsers());

    expect(names(store.administrators)).toEqual(['Alice']);
    expect(names(store.nonAdministrators)).toEqual(['Bob']);
  });

  it('moves a member into the administrators the moment they are added', async () => {
    const store = await makeStore();
    await E.runPromise(store.getAllNetworkAdministrators());
    await E.runPromise(store.fetchAllUsers());

    await E.runPromise(store.addNetworkAdministrator(bobHash, [new Uint8Array(39).fill(8)]));

    expect(names(store.administrators)).toEqual(['Alice', 'Bob']);
    expect(store.nonAdministrators).toEqual([]);
  });

  it('moves an administrator back among the members the moment they are removed', async () => {
    const store = await makeStore();
    await E.runPromise(store.fetchAllUsers());
    await E.runPromise(store.getAllNetworkAdministrators());

    await E.runPromise(store.removeNetworkAdministrator(aliceHash, [new Uint8Array(39).fill(7)]));

    expect(store.administrators).toEqual([]);
    expect(names(store.nonAdministrators)).toEqual(['Alice', 'Bob']);
  });
});
