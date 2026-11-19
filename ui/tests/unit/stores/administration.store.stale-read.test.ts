import { describe, it, expect, vi, beforeEach } from 'vitest';
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
 * **A status the administrator wrote is not undone by a read from before it** (#411, walk
 * of 16 November).
 *
 * A status is read through a link that each write replaces, from the network. For about a
 * minute after an administrator accepted or suspended a member, the Admin menu's re-read
 * could still answer with the status before the write, and the admin pages showed the
 * member where they were until the network caught up. The network here answers the same
 * way: the old status until it is told to catch up.
 */

const memberHash = new Uint8Array(39).fill(5);
const orgHash = new Uint8Array(39).fill(6);

// What the network answers for each entry: a status and the time it was written (ms).
const network = vi.hoisted(() => ({
  member: { status_type: 'accepted', created_at: 1_000 },
  org: { status_type: 'accepted', created_at: 1_000 }
}));

vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    getLatestUser: vi.fn(() =>
      E.succeed({
        name: 'Pat Member',
        original_action_hash: new Uint8Array(39).fill(5),
        status: { ...network.member }
      })
    )
  }
}));
vi.mock('$lib/stores/organizations.store.svelte', () => ({
  default: {
    getLatestOrganization: vi.fn(() =>
      E.succeed({
        name: 'Pat Co',
        original_action_hash: new Uint8Array(39).fill(6),
        status: { ...network.org }
      })
    )
  }
}));

import { createAdministrationStore } from '$lib/stores/administration.store.svelte';

// The record a status write returns, written at `ms` (the action's time is in microseconds).
const written = (status_type: string, ms: number) =>
  ({
    signed_action: {
      hashed: {
        hash: new Uint8Array(39).fill(9),
        content: { header: { timestamp: ms * 1000 }, data: { type: 'Update' } }
      }
    },
    entry: { Present: { entry: encode({ status_type, created_at: ms, updated_at: ms }) } }
  }) as unknown as HcRecord;

let writeAt = 2_000;
const makeStore = () =>
  E.runPromise(
    createAdministrationStore().pipe(
      E.provideService(AdministrationServiceTag, {
        getAllUsersLinks: vi.fn(() => E.succeed([{ target: memberHash }])),
        getAllOrganizationsLinks: vi.fn(() => E.succeed([{ target: orgHash }])),
        // The write lands, but the network does not answer with it yet.
        updateEntityStatus: vi.fn((input: { new_status: { status_type: string } }) =>
          E.succeed(written(input.new_status.status_type, writeAt))
        )
      } as unknown as AdministrationService),
      E.provide(CacheServiceLive),
      E.provideService(HolochainClientServiceTag, {} as HolochainClientService)
    )
  );

beforeEach(() => {
  network.member = { status_type: 'accepted', created_at: 1_000 };
  network.org = { status_type: 'accepted', created_at: 1_000 };
  writeAt = 2_000;
});

describe('a status write and a read from before it', () => {
  it('keeps a suspended member suspended until the network catches up, then follows it', async () => {
    const store = await makeStore();
    await E.runPromise(store.refreshLists());

    await E.runPromise(
      store.updateUserStatus(memberHash, memberHash, memberHash, {
        status_type: 'suspended temporarily'
      } as never)
    );
    // The Admin menu's tick, while the network still has the member accepted.
    await E.runPromise(store.refreshLists());
    expect(store.allUsers[0]?.status?.status_type).toBe('suspended temporarily');

    // The network catches up; then another administrator accepts the member again.
    network.member = { status_type: 'suspended temporarily', created_at: 2_000 };
    await E.runPromise(store.refreshLists());
    expect(store.allUsers[0]?.status?.status_type).toBe('suspended temporarily');
    network.member = { status_type: 'accepted', created_at: 3_000 };
    await E.runPromise(store.refreshLists());
    expect(store.allUsers[0]?.status?.status_type).toBe('accepted');
  });

  it('keeps an accepted organization accepted until the network catches up, then follows it', async () => {
    network.org = { status_type: 'pending', created_at: 1_000 };
    const store = await makeStore();
    await E.runPromise(store.refreshLists());

    await E.runPromise(
      store.updateOrganizationStatus(orgHash, orgHash, orgHash, {
        status_type: 'accepted'
      } as never)
    );
    await E.runPromise(store.refreshLists());
    expect(store.allOrganizations[0]?.status?.status_type).toBe('accepted');

    network.org = { status_type: 'accepted', created_at: 2_000 };
    await E.runPromise(store.refreshLists());
    network.org = { status_type: 'suspended indefinitely', created_at: 3_000 };
    await E.runPromise(store.refreshLists());
    expect(store.allOrganizations[0]?.status?.status_type).toBe('suspended indefinitely');
  });
});
