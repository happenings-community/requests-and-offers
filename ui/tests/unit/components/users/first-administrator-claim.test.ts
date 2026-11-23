import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { Effect as E, Layer } from 'effect';
import { encode } from '@msgpack/msgpack';
import type { Record as HcRecord } from '@holochain/client';
import { CacheServiceLive } from '$lib/utils/cache.svelte';
import {
  HolochainClientServiceTag,
  type HolochainClientService
} from '$lib/services/HolochainClientService.svelte';
import {
  UsersServiceLive,
  UsersServiceTag,
  type UsersService
} from '$lib/services/zomes/users.service';

// The users store reads statuses through the administration store, imported at module level.
vi.mock('$lib/stores/administration.store.svelte', () => ({
  default: { getLatestStatusForEntity: vi.fn() }
}));

import { createUsersStore } from '$lib/stores/users.store.svelte';

/**
 * **The first administrator is a choice, never a side effect of a profile** (#600).
 *
 * On the 22 November rehearsal a joiner whose node had not synced saw no administrator and
 * `create_user` gave them the seat. Now a profile makes nobody administrator on a network
 * with no progenitor key; the profile form offers an unticked "I am creating this network"
 * box while the seat is open, and the store claims it after the profile only when ticked.
 */

describe('the users service names the claim calls', () => {
  const callZome = vi.fn(() => Promise.resolve(true));
  const holochainClient = {
    callZome,
    waitForConnection: vi.fn(() => Promise.resolve())
  } as unknown as HolochainClientService;
  const service = E.runSync(
    E.provide(
      UsersServiceTag,
      Layer.provide(UsersServiceLive, Layer.succeed(HolochainClientServiceTag, holochainClient))
    )
  );

  it('asks whether the seat is open', async () => {
    await E.runPromise(service.canClaimFirstAdministrator());
    expect(callZome).toHaveBeenLastCalledWith(
      'users_organizations',
      'can_claim_first_administrator',
      null
    );
  });

  it('claims the seat', async () => {
    await E.runPromise(service.claimFirstAdministrator());
    expect(callZome).toHaveBeenLastCalledWith(
      'users_organizations',
      'claim_first_administrator',
      null
    );
  });
});

describe('the profile form asks for the seat only when the box is ticked', () => {
  // Read from the source, as startup-progress.test.ts reads the layout: the form needs the
  // whole app (Skeleton modals, stores, routing) to mount, and these are wiring facts.
  const form = readFileSync('src/lib/components/users/UserForm.svelte', 'utf8');

  it('offers the box in create mode only, and only while the seat is open', () => {
    expect(form).toMatch(/\{#if mode === 'create' && canClaimFirstAdmin\}/);
    expect(form).toContain('data-testid="claim-first-administrator"');
    expect(form).toMatch(/usersStore\.canClaimFirstAdministrator\(\)/);
  });

  it('starts unticked, so a joiner who does nothing stays a pending member', () => {
    expect(form).toMatch(/let claimFirstAdmin = \$state\(false\);/);
  });

  it('asks for the seat only when the box is offered and ticked', () => {
    expect(form).toMatch(
      /claimFirstAdministrator: mode === 'create' && canClaimFirstAdmin && claimFirstAdmin/
    );
    expect(form.match(/await onSubmit\((userInput|userData), claimOptions\(\)\);/g)).toHaveLength(
      2
    );
  });

  it('says so when the claim is refused, instead of the welcome', () => {
    expect(
      form.match(/usersStore\.firstAdministratorClaimRefused\s*\?\s*claimRefusedModal\(\)/g)
    ).toHaveLength(2);
  });
});

describe('the users store claims the seat after the profile, only when asked', () => {
  const record = {
    signed_action: {
      hashed: {
        hash: new Uint8Array(39).fill(3),
        content: { header: { timestamp: Date.now() * 1000 }, data: { type: 'Create' } }
      }
    },
    entry: {
      Present: {
        entry: encode({ name: 'Pat', nickname: 'pat', user_type: 'advocate', email: 'p@e.org' })
      }
    }
  } as unknown as HcRecord;

  const order: string[] = [];
  const claim = vi.fn(() => {
    order.push('claim');
    return E.succeed(true) as E.Effect<boolean, never>;
  });
  const usersService = {
    createUser: vi.fn(() => {
      order.push('create');
      return E.succeed(record);
    }),
    claimFirstAdministrator: claim
  } as unknown as UsersService;

  const makeStore = () =>
    E.runPromise(
      createUsersStore().pipe(
        E.provideService(UsersServiceTag, usersService),
        E.provide(CacheServiceLive),
        E.provideService(HolochainClientServiceTag, {
          callZome: vi.fn(),
          waitForConnection: vi.fn(() => Promise.resolve())
        } as unknown as HolochainClientService)
      )
    );
  const input = { name: 'Pat', nickname: 'pat', user_type: 'advocate', email: 'p@e.org' } as never;

  beforeEach(() => {
    order.length = 0;
    claim.mockClear();
  });

  it('never claims for a profile created without the box', async () => {
    const store = await makeStore();
    await E.runPromise(store.createUser(input));
    await E.runPromise(store.createUser(input, { claimFirstAdministrator: false }));
    expect(claim).not.toHaveBeenCalled();
  });

  it('claims once the profile exists', async () => {
    const store = await makeStore();
    await E.runPromise(store.createUser(input, { claimFirstAdministrator: true }));
    expect(order).toEqual(['create', 'claim']);
    expect(store.firstAdministratorClaimRefused).toBe(false);
  });

  it('keeps the profile and says the claim was refused', async () => {
    claim.mockImplementationOnce(
      () => E.fail(new Error('This network already has an administrator')) as never
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = await makeStore();
    const user = await E.runPromise(store.createUser(input, { claimFirstAdministrator: true }));
    expect(user).toBeTruthy();
    expect(store.firstAdministratorClaimRefused).toBe(true);
  });
});
