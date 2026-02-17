/**
 * Store Layer Template — aligned with serviceTypes.store.svelte.ts
 * Replace {{DomainName}} (PascalCase) and {{domain_name}} (snake_case).
 * File MUST be named {{domain_name}}.store.svelte.ts (Svelte 5 runes require .svelte.ts)
 */

import type { ActionHash, Record } from '@holochain/client';
import { encodeHashToBase64 } from '@holochain/client';
import {
  HolochainClientServiceTag,
  HolochainClientServiceLive
} from '$lib/services/HolochainClientService.svelte';
import {
  {{DomainName}}ServiceTag,
  {{DomainName}}ServiceLive
} from '$lib/services/zomes/{{domain_name}}.service';
import type { UI{{DomainName}} } from '$lib/types/ui';
import type { {{DomainName}}InDHT } from '$lib/types/holochain';

import {
  CacheServiceTag,
  CacheServiceLive
} from '$lib/utils/cache.svelte';
import { Effect as E, pipe } from 'effect';
import { {{DomainName}}Error } from '$lib/errors/{{domain_name}}.errors';
import { {{DOMAIN_NAME}}_CONTEXTS } from '$lib/errors/error-contexts';

// Import standardized store helpers
import {
  withLoadingState,
  createGenericCacheSyncHelper,
  createStatusAwareEventEmitters,
  createUIEntityFromRecord,
  createStatusTransitionHelper,
  processMultipleRecordCollections,
  type LoadingStateSetter,
  type EntityStatus
} from '$lib/utils/store-helpers';

// ============================================================================
// ENTITY CREATION
// ============================================================================

const createUI{{DomainName}} = createUIEntityFromRecord<{{DomainName}}InDHT, UI{{DomainName}}>(
  (entry, actionHash, timestamp, additionalData) => ({
    ...entry,
    original_action_hash: actionHash,
    previous_action_hash: actionHash,
    creator: additionalData?.authorPubKey as ActionHash | undefined,
    created_at: timestamp,
    updated_at: timestamp,
    status: (additionalData?.status as EntityStatus) || 'approved'
  })
);

// ============================================================================
// EVENT EMITTERS
// ============================================================================

const eventEmitters = createStatusAwareEventEmitters<UI{{DomainName}}>('{{domain_name}}');

// ============================================================================
// STORE FACTORY
// ============================================================================

export const create{{DomainName}}Store = (): E.Effect<
  {{DomainName}}Store,
  never,
  HolochainClientServiceTag | {{DomainName}}ServiceTag | CacheServiceTag
> =>
  E.gen(function* () {
    const service = yield* {{DomainName}}ServiceTag;
    const cacheService = yield* CacheServiceTag;

    // --- Svelte 5 Runes State ---
    const entities: UI{{DomainName}}[] = $state([]);
    const pendingEntities: UI{{DomainName}}[] = $state([]);
    const approvedEntities: UI{{DomainName}}[] = $state([]);
    const rejectedEntities: UI{{DomainName}}[] = $state([]);
    let loading: boolean = $state(false);
    let error: string | null = $state(null);

    // --- Loading state management ---
    const setters: LoadingStateSetter = {
      setLoading: (v) => { loading = v; },
      setError: (v) => { error = v; }
    };

    // --- Cache sync ---
    const { syncCacheToState } = createGenericCacheSyncHelper({
      all: entities,
      pending: pendingEntities,
      approved: approvedEntities,
      rejected: rejectedEntities
    });

    // --- Cache ---
    const cache = yield* cacheService.createEntityCache<UI{{DomainName}}>({ expiryMs: 300_000, debug: false });

    // --- Status transitions ---
    const { transitionEntityStatus } = createStatusTransitionHelper(
      { pending: pendingEntities, approved: approvedEntities, rejected: rejectedEntities },
      cache
    );

    // --- CRUD Operations (use withLoadingState + pipe pattern) ---

    const getAll = (): E.Effect<UI{{DomainName}}[], {{DomainName}}Error> =>
      withLoadingState(() =>
        pipe(
          service.getAll{{DomainName}}s(),
          E.flatMap((result) =>
            E.try({
              try: () => processMultipleRecordCollections(
                { converter: createUI{{DomainName}}, cache, targetArrays: {
                    all: entities, pending: pendingEntities,
                    approved: approvedEntities, rejected: rejectedEntities
                }},
                result
              ),
              catch: (err) => {{DomainName}}Error.fromError(err, {{DOMAIN_NAME}}_CONTEXTS.GET_ALL)
            })
          ),
          E.map(() => entities)
        )
      )(setters);

    const create = (input: {{DomainName}}InDHT): E.Effect<Record, {{DomainName}}Error> =>
      withLoadingState(() =>
        pipe(
          service.create{{DomainName}}(input),
          E.tap((record) => {
            const authorPubKey = record.signed_action.hashed.content.author;
            const entity = createUI{{DomainName}}(record, { status: 'approved', authorPubKey });
            if (entity) {
              E.runSync(cache.set(encodeHashToBase64(record.signed_action.hashed.hash), entity));
              syncCacheToState(entity, 'add');
              eventEmitters.emitCreated(entity);
            }
          })
        )
      )(setters);

    // --- Return store interface ---
    return {
      get entities() { return entities; },
      get loading() { return loading; },
      get error() { return error; },
      getAll,
      create,
      invalidateCache: () => E.runSync(cache.clear())
    };
  });

// ============================================================================
// STORE INSTANCE
// ============================================================================

const store = pipe(
  create{{DomainName}}Store(),
  E.provide(CacheServiceLive),
  E.provide({{DomainName}}ServiceLive),
  E.provide(HolochainClientServiceLive),
  E.runSync
);

export default store;
