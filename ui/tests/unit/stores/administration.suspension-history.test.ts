import { describe, it, expect, vi } from 'vitest';
import { Effect as E, Layer } from 'effect';
import { encode } from '@msgpack/msgpack';
import type { Record as HcRecord } from '@holochain/client';
import type { UIUser } from '$lib/types/ui';

// The store imports these at module level; neither is under test here.
vi.mock('$lib/stores/users.store.svelte', () => ({ default: {} }));
vi.mock('$lib/stores/organizations.store.svelte', () => ({ default: {} }));

import { createAdministrationStore } from '$lib/stores/administration.store.svelte';
import { AdministrationServiceTag } from '$lib/services/zomes/administration.service';
import { CacheServiceLive } from '$lib/utils/cache.svelte';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';

/**
 * **The status history shows what a temporary suspension had left** when each revision
 * was written. It never did: the history's revisions were built without a `duration`, and
 * the one place that set one read a text end as milliseconds and took the revision's
 * microseconds from it. The end is a Holochain timestamp now.
 *
 * **To make this go red:** drop `duration` from `createUIStatusFromRecord`.
 */

const DAY_US = 24 * 60 * 60 * 1_000_000;
const hash = (n: number) => new Uint8Array(Array(39).fill(n));
const WRITTEN_AT = Date.UTC(2026, 10, 18, 12) * 1000;

const statusRecord = (status: object, at: number, n: number): HcRecord =>
  ({
    signed_action: {
      hashed: { hash: hash(n), content: { header: { timestamp: at }, data: { type: 'Update' } } },
      signature: new Uint8Array(64)
    },
    entry: { Present: { entry_type: 'App', entry: encode(status) } }
  }) as unknown as HcRecord;

const suspension = statusRecord(
  {
    status_type: 'suspended temporarily',
    reason: 'A week out',
    suspended_until: WRITTEN_AT + 7 * DAY_US
  },
  WRITTEN_AT,
  2
);
const accepted = statusRecord(
  { status_type: 'accepted', reason: null, suspended_until: null },
  WRITTEN_AT - DAY_US,
  1
);

const store = () =>
  E.runSync(
    createAdministrationStore().pipe(
      E.provide(
        Layer.succeed(AdministrationServiceTag, {
          getLatestStatusRecordForEntity: () => E.succeed(suspension),
          getAllRevisionsForStatus: () => E.succeed([accepted, suspension])
        } as never)
      ),
      E.provide(CacheServiceLive),
      E.provide(Layer.succeed(HolochainClientServiceTag, {} as never))
    )
  );

describe('the status history of a temporary suspension', () => {
  it('shows the time it had left when written, in milliseconds', async () => {
    const user = { original_action_hash: hash(9), status: undefined } as unknown as UIUser;
    const revisions = await E.runPromise(store().getAllRevisionsForStatus(user));
    const temporary = revisions.find((r) => r.status_type === 'suspended temporarily');
    expect(temporary?.suspended_until).toBe(WRITTEN_AT + 7 * DAY_US);
    expect(temporary?.duration).toBe(7 * 24 * 60 * 60 * 1000);
    expect(revisions.find((r) => r.status_type === 'accepted')?.duration).toBeUndefined();
  });
});
