/**
 * Template for creating new Effect-TS stores with 9 standardized helper functions
 * Copy this template and replace {{DOMAIN_NAME}} with your domain name
 */

import { Effect as E, pipe } from 'effect';
import { writable, derived, readable } from 'svelte/store';
import type { ActionHash, Record } from '@holochain/client';
import { EntityCache } from '$lib/services/entity-cache.service';

// Import domain-specific types
// import { {{DOMAIN_NAME}}Service } from '$lib/services/zomes/{{domain_name}}.service';
// import { {{DOMAIN_NAME}}Error } from '$lib/errors/{{domain_name}}.errors';
// import {
//   {{DOMAIN_NAME}}InDHT,
//   UI{{DOMAIN_NAME}},
//   {{DOMAIN_NAME}}Collection,
//   // ... other schemas
// } from '$lib/schemas/{{domain_name}}.schemas';

// Type definitions
type {{DOMAIN_NAME}}Map = Map<string, UI{{DOMAIN_NAME}}>;
type {{DOMAIN_NAME}}Status = 'pending' | 'approved' | 'rejected';

// Store interface
export interface {{DOMAIN_NAME}}Store {
  // State
  entities: readable<{{DOMAIN_NAME}}Map>;
  loading: readable<boolean>;
  error: readable<{{DOMAIN_NAME}}Error | null>;
  status: readable<{{DOMAIN_NAME}}Status>;

  // Collections
  pendingEntities: readable<UI{{DOMAIN_NAME}}[]>;
  approvedEntities: readable<UI{{DOMAIN_NAME}}[]>;
  rejectedEntities: readable<UI{{DOMAIN_NAME}}[]>;

  // Actions
  create{{DOMAIN_NAME}}: (input: {{DOMAIN_NAME}}InDHT) => E.Effect<UI{{DOMAIN_NAME}}, {{DOMAIN_NAME}}Error>;
  update{{DOMAIN_NAME}}: (id: ActionHash, input: {{DOMAIN_NAME}}InDHT) => E.Effect<UI{{DOMAIN_NAME}}, {{DOMAIN_NAME}}Error>;
  delete{{DOMAIN_NAME}}: (id: ActionHash) => E.Effect<void, {{DOMAIN_NAME}}Error>;
  fetchAll{{DOMAIN_NAME}}s: () => E.Effect<void, {{DOMAIN_NAME}}Error>;
  approve{{DOMAIN_NAME}}: (id: ActionHash) => E.Effect<void, {{DOMAIN_NAME}}Error>;
  reject{{DOMAIN_NAME}}: (id: ActionHash, reason?: string) => E.Effect<void, {{DOMAIN_NAME}}Error>;

  // Events
  on{{DOMAIN_NAME}}Created: (callback: (entity: UI{{DOMAIN_NAME}}) => void) => () => void;
  on{{DOMAIN_NAME}}Updated: (callback: (entity: UI{{DOMAIN_NAME}}) => void) => () => void;
  on{{DOMAIN_NAME}}Deleted: (callback: (id: ActionHash) => void) => () => void;
}

export const create{{DOMAIN_NAME}}Store = E.gen(function* () {
  const service = yield* {{DOMAIN_NAME}}Service;
  const entityCache = yield* EntityCache.make({
    name: '{{domain_name}}',
    ttl: Duration.minutes(15)
  });

  // State stores
  const entities = writable<{{DOMAIN_NAME}}Map>(new Map());
  const loading = writable(false);
  const error = writable<{{DOMAIN_NAME}}Error | null>(null);
  const status = writable<{{DOMAIN_NAME}}Status>('pending');

  // Event emitters
  const eventEmitter = new EventTarget();

  // === HELPER FUNCTION 1: createUIEntity ===
  const createUIEntity = (record: Record): UI{{DOMAIN_NAME}} => {
    const {{domain_name}} = record.entry as any;
    return {
      id: record.signed_action.hashed.hash,
      revisionId: record.signed_action.hashed.hash,
      createdAt: new Date(record.signed_action.hashed.timestamp * 1000),
      updatedAt: new Date(record.signed_action.hashed.timestamp * 1000),
      status: {{domain_name}}.status || 'pending',
      ...{{domain_name}}
    };
  };

  // === HELPER FUNCTION 2: mapRecordsToUIEntities ===
  const mapRecordsToUIEntities = (records: Record[]): UI{{DOMAIN_NAME}}[] => {
    return records
      .filter(record => record.entry)
      .map(createUIEntity)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  };

  // === HELPER FUNCTION 3: createCacheSyncHelper ===
  const createCacheSyncHelper = () => {
    return {
      syncToCache: (entity: UI{{DOMAIN_NAME}}) =>
        E.sync(entityCache.set(entity.id, entity)),
      getFromCache: (id: ActionHash) =>
        E.sync(entityCache.get(id)),
      invalidateCache: (id: ActionHash) =>
        E.sync(entityCache.delete(id))
    };
  };

  // === HELPER FUNCTION 4: createStatusAwareEventEmitters ===
  const createStatusAwareEventEmitters = () => {
    return {
      emitCreated: (entity: UI{{DOMAIN_NAME}}) => {
        eventEmitter.dispatchEvent(new CustomEvent('{{domain_name}}:created', { detail: entity }));
      },
      emitUpdated: (entity: UI{{DOMAIN_NAME}}) => {
        eventEmitter.dispatchEvent(new CustomEvent('{{domain_name}}:updated', { detail: entity }));
      },
      emitDeleted: (id: ActionHash) => {
        eventEmitter.dispatchEvent(new CustomEvent('{{domain_name}}:deleted', { detail: id }));
      },
      emitStatusChanged: (id: ActionHash, newStatus: {{DOMAIN_NAME}}Status) => {
        eventEmitter.dispatchEvent(new CustomEvent('{{domain_name}}:status-changed', {
          detail: { id, status: newStatus }
        }));
      }
    };
  };

  // === HELPER FUNCTION 5: createEntitiesFetcher ===
  const createEntitiesFetcher = () => {
    return pipe(
      E.gen(function* () {
        loading.set(true);
        error.set(null);

        const collection = yield* service.getAll{{DOMAIN_NAME}}s();

        // Update entities by status
        const allEntities = [
          ...mapRecordsToUIEntities(collection.pending),
          ...mapRecordsToUIEntities(collection.approved),
          ...mapRecordsToUIEntities(collection.rejected)
        ];

        entities.update(current => {
          const updated = new Map(current);
          allEntities.forEach(entity => {
            updated.set(entity.id, entity);
          });
          return updated;
        });

      }),
      E.catchAll((err) => {
        error.set(err);
        return E.unit;
      }),
      E.finally(() => E.sync(() => loading.set(false)))
    );
  };

  // === HELPER FUNCTION 6: withLoadingState ===
  const withLoadingState = <A, E>(effect: E.Effect<A, E>) =>
    pipe(
      E.gen(function* () {
        loading.set(true);
        error.set(null);
        return yield* effect;
      }),
      E.catchAll((err) => {
        error.set(err as {{DOMAIN_NAME}}Error);
        return E.fail(err);
      }),
      E.finally(() => E.sync(() => loading.set(false)))
    );

  // === HELPER FUNCTION 7: createRecordCreationHelper ===
  const createRecordCreationHelper = (
    createFunction: (input: any) => E.Effect<Record, {{DOMAIN_NAME}}Error>
  ) => (input: {{DOMAIN_NAME}}InDHT) =>
    pipe(
      withLoadingState(
        E.gen(function* () {
          const record = yield* createFunction(input);
          const uiEntity = createUIEntity(record);

          // Update state
          entities.update(current => {
            const updated = new Map(current);
            updated.set(uiEntity.id, uiEntity);
            return updated;
          });

          // Emit events
          const emitters = createStatusAwareEventEmitters();
          emitters.emitCreated(uiEntity);

          return uiEntity;
        })
      )
    );

  // === HELPER FUNCTION 8: createStatusTransitionHelper ===
  const createStatusTransitionHelper = () => {
    return {
      approve: (id: ActionHash) =>
        pipe(
          service.update{{DOMAIN_NAME}}Status(id, 'approved'),
          E.map(() => {
            entities.update(current => {
              const updated = new Map(current);
              const entity = updated.get(id);
              if (entity) {
                updated.set(id, { ...entity, status: 'approved' });
              }
              return updated;
            });

            const emitters = createStatusAwareEventEmitters();
            emitters.emitStatusChanged(id, 'approved');
          })
        ),
      reject: (id: ActionHash, reason?: string) =>
        pipe(
          service.update{{DOMAIN_NAME}}Status(id, 'rejected', reason),
          E.map(() => {
            entities.update(current => {
              const updated = new Map(current);
              const entity = updated.get(id);
              if (entity) {
                updated.set(id, { ...entity, status: 'rejected' });
              }
              return updated;
            });

            const emitters = createStatusAwareEventEmitters();
            emitters.emitStatusChanged(id, 'rejected');
          })
        )
    };
  };

  // === HELPER FUNCTION 9: processMultipleRecordCollections ===
  const processMultipleRecordCollections = (
    collections: { pending: Record[]; approved: Record[]; rejected: Record[] }
  ) => {
    const processed = {
      pending: mapRecordsToUIEntities(collections.pending),
      approved: mapRecordsToUIEntities(collections.approved),
      rejected: mapRecordsToUIEntities(collections.rejected)
    };

    entities.update(current => {
      const updated = new Map(current);
      [...processed.pending, ...processed.approved, ...processed.rejected]
        .forEach(entity => {
          updated.set(entity.id, entity);
        });
      return updated;
    });

    return processed;
  };

  // Initialize helpers
  const cacheHelper = createCacheSyncHelper();
  const statusHelper = createStatusTransitionHelper();
  const entitiesFetcher = createEntitiesFetcher();

  // Derived stores
  const pendingEntities = derived(
    entities,
    ($entities) => Array.from($entities.values()).filter(e => e.status === 'pending')
  );

  const approvedEntities = derived(
    entities,
    ($entities) => Array.from($entities.values()).filter(e => e.status === 'approved')
  );

  const rejectedEntities = derived(
    entities,
    ($entities) => Array.from($entities.values()).filter(e => e.status === 'rejected')
  );

  // Event handlers
  const eventHandlers = {
    on{{DOMAIN_NAME}}Created: (callback: (entity: UI{{DOMAIN_NAME}}) => void) => {
      const handler = (event: CustomEvent) => callback(event.detail);
      eventEmitter.addEventListener('{{domain_name}}:created', handler as EventListener);
      return () => eventEmitter.removeEventListener('{{domain_name}}:created', handler as EventListener);
    },
    on{{DOMAIN_NAME}}Updated: (callback: (entity: UI{{DOMAIN_NAME}}) => void) => {
      const handler = (event: CustomEvent) => callback(event.detail);
      eventEmitter.addEventListener('{{domain_name}}:updated', handler as EventListener);
      return () => eventEmitter.removeEventListener('{{domain_name}}:updated', handler as EventListener);
    },
    on{{DOMAIN_NAME}}Deleted: (callback: (id: ActionHash) => void) => {
      const handler = (event: CustomEvent) => callback(event.detail);
      eventEmitter.addEventListener('{{domain_name}}:deleted', handler as EventListener);
      return () => eventEmitter.removeEventListener('{{domain_name}}:deleted', handler as EventListener);
    }
  };

  // Return store interface
  return {
    // State
    entities: readable(entities),
    loading: readable(loading),
    error: readable(error),
    status: readable(status),

    // Collections
    pendingEntities: readable(pendingEntities),
    approvedEntities: readable(approvedEntities),
    rejectedEntities: readable(rejectedEntities),

    // Actions
    create{{DOMAIN_NAME}}: createRecordCreationHelper(service.create{{DOMAIN_NAME}}),
    update{{DOMAIN_NAME}}: (id: ActionHash, input: {{DOMAIN_NAME}}InDHT) =>
      withLoadingState(
        E.gen(function* () {
          const record = yield* service.update{{DOMAIN_NAME}}(id, input);
          const uiEntity = createUIEntity(record);

          entities.update(current => {
            const updated = new Map(current);
            updated.set(uiEntity.id, uiEntity);
            return updated;
          });

          const emitters = createStatusAwareEventEmitters();
          emitters.emitUpdated(uiEntity);

          return uiEntity;
        })
      ),
    delete{{DOMAIN_NAME}}: (id: ActionHash) =>
      withLoadingState(
        E.gen(function* () {
          yield* service.delete{{DOMAIN_NAME}}(id);

          entities.update(current => {
            const updated = new Map(current);
            updated.delete(id);
            return updated;
          });

          const emitters = createStatusAwareEventEmitters();
          emitters.emitDeleted(id);
        })
      ),
    fetchAll{{DOMAIN_NAME}}s: entitiesFetcher,
    approve{{DOMAIN_NAME}}: statusHelper.approve,
    reject{{DOMAIN_NAME}}: statusHelper.reject,

    // Events
    ...eventHandlers
  } as {{DOMAIN_NAME}}Store;
});