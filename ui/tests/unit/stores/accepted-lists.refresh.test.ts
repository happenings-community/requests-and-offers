// The admin refresh reads every member and every organization through getLatestUser and
// getLatestOrganization. Those reads used to add whatever they read to the accepted lists,
// so after one refresh tick the public directory held pending, rejected and suspended
// entries too. Each read now adds only an accepted entry and takes any other out.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { encode } from '@msgpack/msgpack';
import { Effect as E } from 'effect';
import holochainClientService from '$lib/services/HolochainClientService.svelte';
import administrationStore from '$lib/stores/administration.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import organizationsStore from '$lib/stores/organizations.store.svelte';

// byte 1 is the index into STATUS, byte 2 tells users (1) from organizations (2)
const hash = (n: number, domain = 1, kind = 1) => {
  const h = new Uint8Array(39);
  h[0] = kind;
  h[1] = n;
  h[2] = domain;
  return h;
};
const record = (h: Uint8Array, entry: unknown) => ({
  signed_action: {
    hashed: {
      hash: h,
      content: { header: { author: hash(200), timestamp: 1 }, data: { type: 'Create' } }
    }
  },
  entry: { Present: { entry: encode(entry) } }
});
// entry 0 accepted, 1..3 pending, rejected, suspended
const STATUS = ['accepted', 'pending', 'rejected', 'suspended indefinitely'];

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(holochainClientService, 'waitForConnection').mockResolvedValue(undefined);
  vi.spyOn(holochainClientService, 'callZome').mockImplementation((async (
    _zome: string,
    fn: string,
    payload: any
  ) => {
    switch (fn) {
      case 'get_all_users':
        return STATUS.map((_, i) => ({ target: hash(i, 1) }));
      case 'get_all_organizations_links':
        return STATUS.map((_, i) => ({ target: hash(i, 2) }));
      case 'get_accepted_entities':
        return [{ target: hash(0, payload === 'organizations' ? 2 : 1) }];
      case 'get_latest_user_record':
        return record(payload, { name: 'u', nickname: 'u', user_type: 'advocate' });
      case 'get_latest_organization_record':
        return record(payload, { name: 'o', description: 'an organization', full_legal_name: 'O' });
      case 'get_latest_status_record_for_entity':
        return record(hash(99, 0, 3), {
          status_type: STATUS[payload.entity_original_action_hash[1]]
        });
      default:
        return [];
    }
  }) as never);
});

describe('the admin refresh leaves the accepted lists holding accepted entries only', () => {
  it('members', async () => {
    await E.runPromise(usersStore.getAcceptedUsers());
    expect(usersStore.acceptedUsers.map((u) => u.status?.status_type)).toEqual(['accepted']);
    await E.runPromise(administrationStore.refreshLists());
    expect(usersStore.acceptedUsers.map((u) => u.status?.status_type)).toEqual(['accepted']);
  });

  it('organizations', async () => {
    await E.runPromise(organizationsStore.getAcceptedOrganizations());
    expect(organizationsStore.acceptedOrganizations.map((o) => o.status?.status_type)).toEqual([
      'accepted'
    ]);
    await E.runPromise(administrationStore.refreshLists());
    expect(organizationsStore.acceptedOrganizations.map((o) => o.status?.status_type)).toEqual([
      'accepted'
    ]);
  });
});
