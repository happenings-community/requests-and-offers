import type { ActionHash, AgentPubKey, Link, Record } from '@holochain/client';
import { decode } from '@msgpack/msgpack';
import {
  UsersServiceTag,
  UsersServiceLive,
  type UsersService
} from '$lib/services/zomes/users.service';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { HolochainClientLive } from '$lib/services/holochainClient.service';
import { UserStoreError } from '$lib/errors/users.errors';
import { CacheNotFoundError } from '$lib/errors';
import { storeEventBus } from '$lib/stores/storeEvents';
import { Effect as E, pipe } from 'effect';
import type { UIUser, UIStatus } from '$lib/types/ui';
import type { UserInDHT, UserInput } from '$lib/schemas/users.schemas';
import { AdministrationEntity } from '$lib/types/holochain';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const ERROR_CONTEXTS = {
  CREATE_USER: 'Failed to create user',
  GET_USER: 'Failed to get user',
  UPDATE_USER: 'Failed to update user',
  GET_LATEST_USER: 'Failed to get latest user',
  GET_USER_BY_HASH: 'Failed to get user by action hash',
  SET_CURRENT_USER: 'Failed to set current user',
  REFRESH_CURRENT_USER: 'Failed to refresh current user',
  UPDATE_CURRENT_USER: 'Failed to update current user',
  GET_ACCEPTED_USERS: 'Failed to get accepted users',
  GET_USER_STATUS_LINK: 'Failed to get user status link',
  GET_USERS_BY_HASHES: 'Failed to get users by action hashes',
  GET_USER_AGENTS: 'Failed to get user agents',
  GET_USER_BY_AGENT: 'Failed to get user by agent public key',
  REFRESH: 'Failed to refresh user data',
  EMIT_USER_CREATED: 'Failed to emit user created event',
  EMIT_USER_UPDATED: 'Failed to emit user updated event',
  EMIT_USER_LOADED: 'Failed to emit user loaded event',
  EMIT_USER_SYNCED: 'Failed to emit user synced event',
  CACHE_OPERATION: 'Cache operation failed',
  SERVICE_TYPE_FETCH: 'Failed to fetch service types for user'
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type HolochainEntry = {
  Present: {
    entry: Uint8Array;
  };
};

export type UsersStore = {
  readonly currentUser: UIUser | null;
  readonly acceptedUsers: UIUser[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCacheService<UIUser>;

  createUser: (input: UserInput) => E.Effect<UIUser, UserStoreError>;
  getLatestUser: (originalActionHash: ActionHash) => E.Effect<UIUser | null, UserStoreError>;
  getUserByActionHash: (actionHash: ActionHash) => E.Effect<UIUser | null, UserStoreError>;
  setCurrentUser: (user: UIUser) => E.Effect<void, UserStoreError>;
  refreshCurrentUser: () => E.Effect<UIUser | null, UserStoreError>;
  updateCurrentUser: (input: UserInput) => E.Effect<UIUser | null, UserStoreError>;
  getAcceptedUsers: () => E.Effect<UIUser[], UserStoreError>;
  getUserStatusLink: (userHash: ActionHash) => E.Effect<Link | null, UserStoreError>;
  getUsersByActionHashes: (actionHashes: ActionHash[]) => E.Effect<UIUser[], UserStoreError>;
  refresh: () => E.Effect<void, UserStoreError>;
  getUserAgents: (actionHash: ActionHash) => E.Effect<AgentPubKey[], UserStoreError>;
  getUserByAgentPubKey: (agentPubKey: AgentPubKey) => E.Effect<UIUser | null, UserStoreError>;
  invalidateCache: () => void;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a UI user from a record
 */
const createUIUser = (
  record: Record,
  serviceTypeHashes: ActionHash[] = [],
  status?: UIStatus
): UIUser => {
  const decodedEntry = decode((record.entry as HolochainEntry).Present.entry) as UserInDHT;

  return {
    ...decodedEntry,
    original_action_hash: record.signed_action.hashed.hash,
    previous_action_hash: record.signed_action.hashed.hash,
    service_type_hashes: serviceTypeHashes,
    status
  };
};

/**
 * Maps records array to UIUser with consistent error handling
 */
const mapRecordsToUIUsers = (records: Record[]): UIUser[] =>
  records
    .filter(
      (record) =>
        record &&
        record.signed_action &&
        record.signed_action.hashed &&
        record.entry &&
        (record.entry as HolochainEntry).Present &&
        (record.entry as HolochainEntry).Present.entry
    )
    .map((record) => {
      try {
        return createUIUser(record);
      } catch (error) {
        console.error('Error decoding user record:', error);
        return null;
      }
    })
    .filter((user): user is UIUser => user !== null);

// ============================================================================
// STATE MANAGEMENT HELPERS
// ============================================================================

/**
 * Higher-order function to wrap operations with loading state management
 */
const withLoadingState =
  <T, E>(operation: () => E.Effect<T, E>) =>
  (setLoading: (loading: boolean) => void, setError: (error: string | null) => void) =>
    pipe(
      E.sync(() => {
        setLoading(true);
        setError(null);
      }),
      E.flatMap(() => operation()),
      E.tap(() => E.sync(() => setLoading(false))),
      E.tapError((error) =>
        E.sync(() => {
          setLoading(false);
          setError(String(error));
        })
      )
    );

// ============================================================================
// EVENT EMISSION HELPERS
// ============================================================================

/**
 * Creates standardized event emission helpers
 */
const createEventEmitters = () => {
  const emitUserCreated = (user: UIUser): void => {
    try {
      storeEventBus.emit('user:created', { user });
    } catch (error) {
      console.error('Failed to emit user:created event:', error);
    }
  };

  const emitUserUpdated = (user: UIUser): void => {
    try {
      storeEventBus.emit('user:updated', { user });
    } catch (error) {
      console.error('Failed to emit user:updated event:', error);
    }
  };

  const emitUserLoaded = (user: UIUser): void => {
    try {
      storeEventBus.emit('user:loaded', { user });
    } catch (error) {
      console.error('Failed to emit user:loaded event:', error);
    }
  };

  const emitUserSynced = (user: UIUser): void => {
    try {
      storeEventBus.emit('user:synced', { user });
    } catch (error) {
      console.error('Failed to emit user:synced event:', error);
    }
  };

  return {
    emitUserCreated,
    emitUserUpdated,
    emitUserLoaded,
    emitUserSynced
  };
};

// ============================================================================
// DATA FETCHING HELPERS
// ============================================================================

/**
 * Creates a standardized function for fetching and mapping users with state updates
 */
const createUsersFetcher = (
  serviceMethod: () => E.Effect<Record[], unknown>,
  targetArray: UIUser[],
  errorContext: string,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) =>
  withLoadingState(() =>
    pipe(
      serviceMethod(),
      E.map((records) => {
        const uiUsers = mapRecordsToUIUsers(records);
        targetArray.splice(0, targetArray.length, ...uiUsers);
        return uiUsers;
      }),
      E.catchAll((error) => {
        const errorMessage = String(error);
        if (errorMessage.includes('Client not connected')) {
          console.warn('Holochain client not connected, returning empty users array');
          return E.succeed([]);
        }
        return E.fail(UserStoreError.fromError(error, errorContext));
      })
    )
  )(setLoading, setError);

// ============================================================================
// RECORD CREATION HELPERS
// ============================================================================

/**
 * Creates a helper for record creation operations
 */
const createRecordCreationHelper = (
  cache: EntityCacheService<UIUser>,
  syncCacheToState: (entity: UIUser, operation: 'add' | 'update' | 'remove') => void
) => {
  const processCreatedRecord = (
    record: Record,
    serviceTypeHashes: ActionHash[] = [],
    status?: UIStatus
  ) => {
    const newUser = createUIUser(record, serviceTypeHashes, status);
    E.runSync(cache.set(record.signed_action.hashed.hash.toString(), newUser));
    syncCacheToState(newUser, 'add');
    return { record, newUser };
  };

  return { processCreatedRecord };
};

// ============================================================================
// CACHE OPERATIONS HELPERS
// ============================================================================

/**
 * Helper to synchronize cache with local state arrays
 */
const createCacheSyncHelper = (
  currentUser: { set: (user: UIUser | null) => void },
  acceptedUsers: UIUser[]
) => {
  const syncCacheToState = (entity: UIUser, operation: 'add' | 'update' | 'remove') => {
    const hash = entity.original_action_hash?.toString();
    if (!hash) return;

    switch (operation) {
      case 'add':
      case 'update':
        // Update in acceptedUsers if present
        const existingIndex = acceptedUsers.findIndex(
          (user) => user.original_action_hash?.toString() === hash
        );
        if (existingIndex !== -1) {
          acceptedUsers[existingIndex] = entity;
        } else {
          // Only add to acceptedUsers if it has accepted status
          if (entity.status?.status_type === 'accepted') {
            acceptedUsers.push(entity);
          }
        }
        break;
      case 'remove':
        // Remove from acceptedUsers
        const removeIndex = acceptedUsers.findIndex(
          (user) => user.original_action_hash?.toString() === hash
        );
        if (removeIndex !== -1) {
          acceptedUsers.splice(removeIndex, 1);
        }
        break;
    }
  };

  return { syncCacheToState };
};

/**
 * Creates cache lookup function for cache misses
 */
const createCacheLookupFunction = (usersService: UsersService) => {
  const lookupUser = (key: string): E.Effect<UIUser, CacheNotFoundError> =>
    pipe(
      E.tryPromise({
        try: async () => {
          // Parse hash from cache key
          const hashPart = key.includes(':') ? key.split(':')[1] : key;
          const hash = new Uint8Array(Buffer.from(hashPart, 'base64'));

          const record = await E.runPromise(usersService.getLatestUserRecord(hash));
          if (!record || !record.signed_action) {
            throw new CacheNotFoundError({ key });
          }

          return createUIUser(record, []);
        },
        catch: (error) => {
          if (error instanceof CacheNotFoundError) {
            return error;
          }
          return new CacheNotFoundError({ key });
        }
      })
    );

  return { lookupUser };
};

// ============================================================================
// SERVICE TYPE INTEGRATION HELPERS
// ============================================================================

/**
 * Helper to fetch service types for users (avoiding direct store access)
 */
const createServiceTypeFetcher = () => {
  const fetchServiceTypesForUser = (userHash: ActionHash): E.Effect<ActionHash[], never> => {
    // For now, return empty array and rely on event-driven updates
    // This prevents direct access to serviceTypesStore
    return E.succeed([]);
  };

  return { fetchServiceTypesForUser };
};

// ============================================================================
// DEPENDENCY COORDINATION HELPERS
// ============================================================================

/**
 * Helper to coordinate with administration store for status information
 * Uses event-driven communication instead of direct access
 */
const createStatusCoordinator = () => {
  const requestUserStatus = (userHash: ActionHash): E.Effect<UIStatus | null, never> => {
    // Emit event requesting status update instead of direct access
    // Administration store will listen and respond via events
    try {
      // Note: This would need to be added to StoreEvents type
      // storeEventBus.emit('user:status:requested', { userHash });
    } catch (error) {
      console.warn('Failed to request user status:', error);
    }

    // For now, return null and rely on event-driven updates
    return E.succeed(null);
  };

  return { requestUserStatus };
};

// ============================================================================
// STORE FACTORY FUNCTION
// ============================================================================

export const createUsersStore = (): E.Effect<
  UsersStore,
  never,
  UsersServiceTag | CacheServiceTag
> =>
  E.gen(function* () {
    const usersService = yield* UsersServiceTag;
    const cacheService = yield* CacheServiceTag;

    // ========================================================================
    // STATE INITIALIZATION
    // ========================================================================
    let currentUser = $state<UIUser | null>(null);
    const acceptedUsers: UIUser[] = $state([]);
    let loading: boolean = $state(false);
    let error: string | null = $state(null);

    // ========================================================================
    // HELPER INITIALIZATION
    // ========================================================================
    const setLoading = (value: boolean) => {
      loading = value;
    };
    const setError = (value: string | null) => {
      error = value;
    };

    const { syncCacheToState } = createCacheSyncHelper(
      { set: (u) => (currentUser = u) },
      acceptedUsers
    );
    const { lookupUser } = createCacheLookupFunction(usersService);
    const { emitUserCreated, emitUserUpdated, emitUserLoaded, emitUserSynced } =
      createEventEmitters();
    const { fetchServiceTypesForUser } = createServiceTypeFetcher();
    const { requestUserStatus } = createStatusCoordinator();

    // Create cache using the cache service
    const cache = yield* cacheService.createEntityCache<UIUser>(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      lookupUser
    );

    const { processCreatedRecord } = createRecordCreationHelper(cache, syncCacheToState);

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
      acceptedUsers.length = 0;
      currentUser = null;
      setError(null);
    };

    // ========================================================================
    // STORE METHODS
    // ========================================================================

    const createUser = (input: UserInput): E.Effect<UIUser, UserStoreError> =>
      withLoadingState(() =>
        pipe(
          usersService.createUser(input),
          E.map((record) => {
            const { newUser } = processCreatedRecord(
              record,
              Array.from(input.service_type_hashes || [])
            );
            emitUserCreated(newUser);
            return newUser;
          }),
          E.catchAll((error) => E.fail(UserStoreError.createUser(error)))
        )
      )(setLoading, setError);

    const getLatestUser = (
      originalActionHash: ActionHash
    ): E.Effect<UIUser | null, UserStoreError> =>
      withLoadingState(() =>
        pipe(
          usersService.getLatestUserRecord(originalActionHash),
          E.flatMap((record) => {
            if (!record) return E.succeed(null);

            return pipe(
              fetchServiceTypesForUser(originalActionHash),
              E.map((serviceTypeHashes) => {
                const user = createUIUser(record, serviceTypeHashes);
                E.runSync(cache.set(originalActionHash.toString(), user));
                return user;
              })
            );
          }),
          E.catchAll((error) =>
            E.fail(UserStoreError.getUser(error, originalActionHash.toString()))
          )
        )
      )(setLoading, setError);

    const getUserByActionHash = (actionHash: ActionHash): E.Effect<UIUser | null, UserStoreError> =>
      withLoadingState(() =>
        pipe(
          cache.get(actionHash.toString()),
          E.catchAll(() => getLatestUser(actionHash)),
          E.tap((user) => {
            if (user) {
              emitUserLoaded(user);
            }
          }),
          E.catchAll((error) => E.fail(UserStoreError.getUser(error, actionHash.toString())))
        )
      )(setLoading, setError);

    const setCurrentUser = (user: UIUser): E.Effect<void, UserStoreError> =>
      pipe(
        E.sync(() => {
          currentUser = user;
        }),
        E.catchAll((error) =>
          E.fail(UserStoreError.setCurrentUser(error, user.original_action_hash?.toString()))
        )
      );

    const refreshCurrentUser = (): E.Effect<UIUser | null, UserStoreError> =>
      withLoadingState(() =>
        pipe(
          // This would need to be implemented with proper Effect patterns
          // For now, return current user
          E.succeed(currentUser),
          E.tap((user) => {
            if (user) {
              emitUserSynced(user);
            }
          }),
          E.catchAll((error) => E.fail(UserStoreError.refreshCurrentUser(error)))
        )
      )(setLoading, setError);

    const updateCurrentUser = (input: UserInput): E.Effect<UIUser | null, UserStoreError> =>
      withLoadingState(() =>
        pipe(
          E.fromNullable(currentUser),
          E.flatMap((currentUser) => {
            if (!currentUser.original_action_hash || !currentUser.previous_action_hash) {
              return E.fail(new Error('Current user missing required hashes'));
            }

            return pipe(
              usersService.updateUser(
                currentUser.original_action_hash,
                currentUser.previous_action_hash,
                input.user,
                Array.from(input.service_type_hashes || [])
              ),
              E.flatMap((record) => {
                return pipe(
                  fetchServiceTypesForUser(currentUser.original_action_hash!),
                  E.map((serviceTypeHashes) => {
                    const updatedUser: UIUser = {
                      ...createUIUser(record, serviceTypeHashes),
                      status: currentUser.status,
                      original_action_hash: currentUser.original_action_hash,
                      previous_action_hash: record.signed_action.hashed.hash
                    };

                    return updatedUser;
                  })
                );
              }),
              E.tap((updatedUser) => {
                currentUser = updatedUser;
                emitUserUpdated(updatedUser);
              })
            );
          }),
          E.orElse(() => E.succeed(null)),
          E.catchAll((error) =>
            E.fail(UserStoreError.updateUser(error, currentUser?.original_action_hash?.toString()))
          )
        )
      )(setLoading, setError);

    const getAcceptedUsers = (): E.Effect<UIUser[], UserStoreError> =>
      withLoadingState(() =>
        pipe(
          usersService.getAcceptedUsersLinks(),
          E.flatMap((links) =>
            E.all(
              links.map((link) =>
                pipe(
                  getLatestUser(link.target),
                  E.tap((user) => {
                    if (user) {
                      // Request status information via events
                      requestUserStatus(link.target);
                    }
                  })
                )
              )
            )
          ),
          E.map((users) => {
            const validUsers = users.filter((user): user is UIUser => user !== null);
            acceptedUsers.splice(0, acceptedUsers.length, ...validUsers);
            return validUsers;
          }),
          E.catchAll((error) => E.fail(UserStoreError.getAcceptedUsers(error)))
        )
      )(setLoading, setError);

    const getUserStatusLink = (userHash: ActionHash): E.Effect<Link | null, UserStoreError> =>
      pipe(
        usersService.getUserStatusLink(userHash),
        E.catchAll((error) =>
          E.fail(
            UserStoreError.fromError(
              error,
              ERROR_CONTEXTS.GET_USER_STATUS_LINK,
              userHash.toString()
            )
          )
        )
      );

    const getUsersByActionHashes = (
      actionHashes: ActionHash[]
    ): E.Effect<UIUser[], UserStoreError> =>
      withLoadingState(() =>
        pipe(
          E.all(actionHashes.map((hash) => getUserByActionHash(hash))),
          E.map((users) => users.filter((user): user is UIUser => user !== null)),
          E.catchAll((error) => E.fail(UserStoreError.getUsersByHashes(error)))
        )
      )(setLoading, setError);

    const refresh = (): E.Effect<void, UserStoreError> =>
      withLoadingState(() =>
        pipe(
          E.all([refreshCurrentUser(), getAcceptedUsers()]),
          E.asVoid,
          E.catchAll((error) => E.fail(UserStoreError.fromError(error, ERROR_CONTEXTS.REFRESH)))
        )
      )(setLoading, setError);

    const getUserAgents = (actionHash: ActionHash): E.Effect<AgentPubKey[], UserStoreError> =>
      pipe(
        usersService.getUserAgents(actionHash),
        E.catchAll((error) => E.fail(UserStoreError.getUserAgents(error, actionHash.toString())))
      );

    const getUserByAgentPubKey = (
      agentPubKey: AgentPubKey
    ): E.Effect<UIUser | null, UserStoreError> =>
      withLoadingState(() =>
        pipe(
          usersService.getAgentUser(agentPubKey),
          E.flatMap((links) => {
            if (links.length === 0) return E.succeed(null);
            return getUserByActionHash(links[0].target);
          }),
          E.catchAll((error) => E.fail(UserStoreError.getUserByAgent(error)))
        )
      )(setLoading, setError);

    // ========================================================================
    // STORE INTERFACE RETURN
    // ========================================================================

    return {
      get currentUser() {
        return currentUser;
      },
      get acceptedUsers() {
        return acceptedUsers;
      },
      get loading() {
        return loading;
      },
      get error() {
        return error;
      },
      get cache() {
        return cache;
      },

      createUser,
      getLatestUser,
      getUserByActionHash,
      setCurrentUser,
      refreshCurrentUser,
      updateCurrentUser,
      getAcceptedUsers,
      getUserStatusLink,
      getUsersByActionHashes,
      refresh,
      getUserAgents,
      getUserByAgentPubKey,
      invalidateCache
    };
  });

// ============================================================================
// STORE INSTANCE CREATION
// ============================================================================

let _usersStore: UsersStore | null = null;

const getUsersStore = (): UsersStore => {
  if (!_usersStore) {
    _usersStore = pipe(
      createUsersStore(),
      E.provide(UsersServiceLive),
      E.provide(CacheServiceLive),
      E.provide(HolochainClientLive),
      E.runSync
    );
  }
  return _usersStore;
};

const usersStore: UsersStore = new Proxy({} as UsersStore, {
  get(_target, prop) {
    const store = getUsersStore();
    const value = store[prop as keyof UsersStore];
    return typeof value === 'function' ? value.bind(store) : value;
  }
});

export default usersStore;
