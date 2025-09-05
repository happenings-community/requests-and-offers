import type { ActionHash, AgentPubKey, Link, Record } from '@holochain/client';
import { UsersServiceTag, UsersServiceLive } from '$lib/services/zomes/users.service';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { HolochainClientLive } from '$lib/services/holochainClient.service';
import { UserError, USER_CONTEXTS } from '$lib/errors';
import { CacheNotFoundError } from '$lib/errors';
import { Effect as E, pipe } from 'effect';
import type { UIUser, UIStatus } from '$lib/types/ui';
import type { UserInDHT, UserInput } from '$lib/schemas/users.schemas';
import { AdministrationEntity } from '$lib/types/holochain';
import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import administrationStore from '$lib/stores/administration.store.svelte';
import { CACHE_EXPIRY } from '$lib/utils/constants';

// Import standardized store helpers
import {
  withLoadingState,
  createErrorHandler,
  createGenericCacheSyncHelper,
  createEntityFetcher,
  createStandardEventEmitters,
  createUIEntityFromRecord,
  type LoadingStateSetter
} from '$lib/utils/store-helpers';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_EXPIRY_MS = CACHE_EXPIRY.USERS;

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Standardized error handler for User operations
 */
const handleUserError = createErrorHandler(UserError.fromError, 'User operation failed');

/**
 * Create standardized event emitters for User entities
 */
const userEventEmitters = createStandardEventEmitters<UIUser>('user');

/**
 * Create standardized entity fetcher for Users
 */
const userEntityFetcher = createEntityFetcher<UIUser, UserError>(handleUserError);

/**
 * Cache lookup function for users
 */
const userCacheLookup = (key: string): E.Effect<UIUser, CacheNotFoundError, never> => {
  return E.fail(new CacheNotFoundError({ key }));
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type UsersStore = {
  readonly currentUser: UIUser | null;
  readonly acceptedUsers: UIUser[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCacheService<UIUser>;

  createUser: (input: UserInput) => E.Effect<UIUser, UserError>;
  getLatestUser: (originalActionHash: ActionHash) => E.Effect<UIUser | null, UserError>;
  getUserByActionHash: (actionHash: ActionHash) => E.Effect<UIUser | null, UserError>;
  setCurrentUser: (user: UIUser) => E.Effect<void, UserError>;
  refreshCurrentUser: () => E.Effect<UIUser | null, UserError>;
  updateCurrentUser: (input: UserInput) => E.Effect<UIUser | null, UserError>;
  getAcceptedUsers: () => E.Effect<UIUser[], UserError>;
  getUserStatusLink: (userHash: ActionHash) => E.Effect<Link | null, UserError>;
  getUsersByActionHashes: (actionHashes: ActionHash[]) => E.Effect<UIUser[], UserError>;
  refresh: () => E.Effect<void, UserError>;
  getUserAgents: (actionHash: ActionHash) => E.Effect<AgentPubKey[], UserError>;
  getUserByAgentPubKey: (agentPubKey: AgentPubKey) => E.Effect<UIUser | null, UserError>;
  invalidateCache: () => void;
};

// ============================================================================
// ENTITY CREATION HELPERS
// ============================================================================

/**
 * Creates a complete UIUser from a record using standardized helper pattern
 * This demonstrates the use of createUIEntityFromRecord from store-helpers
 */
const createUIUser = createUIEntityFromRecord<UserInDHT, UIUser>(
  (entry, actionHash, timestamp, additionalData) => {
    const serviceTypeHashes = (additionalData?.serviceTypeHashes as ActionHash[]) || [];
    const status = additionalData?.status as UIStatus;

    return {
      ...entry,
      original_action_hash: actionHash,
      previous_action_hash: actionHash,
      service_type_hashes: serviceTypeHashes,
      status,
      created_at: timestamp,
      updated_at: timestamp
    };
  }
);

/**
 * Creates enhanced UIUser from record with additional processing
 * This handles status and service type relationships
 */
const createEnhancedUIUser = (
  record: Record,
  serviceTypeHashes: ActionHash[] = [],
  status?: UIStatus
): UIUser | null => {
  const additionalData = {
    serviceTypeHashes,
    status
  };

  return createUIUser(record, additionalData);
};

/**
 * USERS STORE - USING STANDARDIZED STORE HELPER PATTERNS
 *
 * This store demonstrates the integration of standardized helper functions following the Service Types template:
 *
 * 1. createUIEntityFromRecord - Entity creation from Holochain records
 * 2. createGenericCacheSyncHelper - Cache-to-state synchronization
 * 3. createStandardEventEmitters - Type-safe event emission
 * 4. withLoadingState - Consistent loading/error state management
 * 5. createEntityCreationHelper - Standardized entity creation with validation
 * 6. createErrorHandler - Domain-specific error handling
 * 7. createEntityFetcher - Data fetching with loading state and error handling
 *
 * This implementation focuses on consistent patterns for CRUD operations with
 * proper error handling, caching, and event emission.
 *
 * @returns An Effect that creates a users store with state and methods
 */

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

    // ===== HELPER FUNCTIONS =====

    // 1. LOADING STATE MANAGEMENT - Using LoadingStateSetter interface
    const setters: LoadingStateSetter = {
      setLoading: (value) => {
        loading = value;
      },
      setError: (value) => {
        error = value;
      }
    };

    // 2. CACHE SYNCHRONIZATION - Using createGenericCacheSyncHelper
    const { syncCacheToState } = createGenericCacheSyncHelper({
      all: acceptedUsers
    });

    // 3. EVENT EMITTERS - Using createStandardEventEmitters
    const eventEmitters = userEventEmitters;

    // 4. CACHE MANAGEMENT - Using standardized cache lookup pattern
    const cache = yield* cacheService.createEntityCache<UIUser>(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      userCacheLookup
    );

    // 5. ENTITY CREATION - Using createEntityCreationHelper

    // ===== STATE MANAGEMENT FUNCTIONS =====

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
      acceptedUsers.length = 0;
      currentUser = null;
      setters.setError(null);
    };

    // ===== CORE CRUD OPERATIONS =====

    const createUser = (input: UserInput): E.Effect<UIUser, UserError> =>
      withLoadingState(() =>
        pipe(
          usersService.createUser(input),
          E.map((record) => {
            const serviceTypeHashes = Array.from(input.service_type_hashes || []);
            const newUser = createEnhancedUIUser(record, serviceTypeHashes);

            if (newUser) {
              E.runSync(cache.set(record.signed_action.hashed.hash.toString(), newUser));
              syncCacheToState(newUser, 'add');
              currentUser = newUser;
              eventEmitters.emitCreated(newUser);
              return newUser;
            }

            throw new Error('Failed to create UI user');
          }),
          E.catchAll((error) => E.fail(UserError.fromError(error, USER_CONTEXTS.CREATE_USER)))
        )
      )(setters);

    const getLatestUser = (originalActionHash: ActionHash): E.Effect<UIUser | null, UserError> =>
      withLoadingState(() =>
        pipe(
          usersService.getLatestUserRecord(originalActionHash),
          E.flatMap((record) => {
            if (!record) return E.succeed(null);

            return pipe(
              administrationStore.getLatestStatusForEntity(
                originalActionHash,
                AdministrationEntity.Users
              ),
              E.map((status) => {
                const user = createEnhancedUIUser(record, [], status || undefined);
                if (user) {
                  // CRITICAL FIX for Issue #57: Preserve the original_action_hash parameter
                  // createEnhancedUIUser sets it to the record hash, but we need the creation hash
                  const correctedUser: UIUser = {
                    ...user,
                    original_action_hash: originalActionHash  // ← Use the parameter, not the record hash
                  };
                  E.runSync(cache.set(originalActionHash.toString(), correctedUser));
                  syncCacheToState(correctedUser, 'add');
                  return correctedUser;
                }
                return null;
              })
            );
          }),
          E.catchAll((error) =>
            E.fail(
              UserError.fromError(error, USER_CONTEXTS.GET_USER, originalActionHash.toString())
            )
          )
        )
      )(setters);

    const getUserByActionHash = (actionHash: ActionHash): E.Effect<UIUser | null, UserError> =>
      withLoadingState(() =>
        pipe(
          cache.get(actionHash.toString()),
          E.catchAll(() => getLatestUser(actionHash)),
          E.tap((user) => {
            if (user) {
              eventEmitters.emitCreated(user);
            }
          }),
          E.catchAll((error) =>
            E.fail(
              UserError.fromError(error, USER_CONTEXTS.GET_USER_BY_HASH, actionHash.toString())
            )
          )
        )
      )(setters);

    const setCurrentUser = (user: UIUser): E.Effect<void, UserError> =>
      pipe(
        E.sync(() => {
          currentUser = user;
        }),
        E.catchAll((error) =>
          E.fail(
            UserError.fromError(
              error,
              USER_CONTEXTS.GET_CURRENT_USER,
              user.original_action_hash?.toString()
            )
          )
        )
      );

    const refreshCurrentUser = (): E.Effect<UIUser | null, UserError> =>
      withLoadingState(() =>
        pipe(
          // Get the current agent's public key from Holochain
          E.gen(function* () {
            const holochainClient = yield* HolochainClientServiceTag;
            const appInfo = yield* holochainClient.getAppInfoEffect();
            if (!appInfo?.agent_pub_key) {
              return null;
            }
            return appInfo.agent_pub_key;
          }),
          E.flatMap((agentPubKey) => {
            if (!agentPubKey) {
              return E.succeed(null);
            }

            // Get the user profile links for this agent
            return pipe(
              usersService.getAgentUser(agentPubKey),
              E.flatMap((links) => {
                if (links.length === 0) {
                  return E.succeed(null);
                }

                // Get the latest user record
                return pipe(
                  getLatestUser(links[0].target),
                  E.flatMap((user) => {
                    if (!user) return E.succeed(null);
                    return pipe(
                      administrationStore.getLatestStatusForEntity(
                        links[0].target,
                        AdministrationEntity.Users
                      ),
                      E.map((status) => ({ ...user, status: status || undefined }) as UIUser)
                    );
                  }),
                  E.tap((user) => {
                    // Set the current user and emit sync event
                    if (user) {
                      currentUser = user;
                      eventEmitters.emitStatusChanged?.(user);
                    }
                  })
                );
              })
            );
          }),
          E.provide(HolochainClientLive),
          E.catchAll((error) => E.fail(UserError.fromError(error, USER_CONTEXTS.GET_CURRENT_USER)))
        )
      )(setters);

    const updateCurrentUser = (input: UserInput): E.Effect<UIUser | null, UserError> =>
      withLoadingState(() =>
        pipe(
          E.fromNullable(currentUser),
          E.flatMap((existingUser) => {
            if (!existingUser.original_action_hash || !existingUser.previous_action_hash) {
              return E.fail(new Error('Current user missing required hashes'));
            }

            // DEBUG: Log hash values being sent to backend
            console.log('🔍 [updateCurrentUser] Hash values:', {
              original_action_hash: existingUser.original_action_hash?.toString(),
              previous_action_hash: existingUser.previous_action_hash?.toString(),
              user_data: input.user
            });

            return pipe(
              usersService.updateUser(
                existingUser.original_action_hash,
                existingUser.previous_action_hash,
                input.user,
                Array.from(input.service_type_hashes || [])
              ),
              E.map((record) => {
                const serviceTypeHashes = Array.from(input.service_type_hashes || []);

                // Create user with enhanced function first
                const baseUser = createEnhancedUIUser(
                  record,
                  serviceTypeHashes,
                  existingUser.status
                );

                if (!baseUser) {
                  throw new Error('Failed to create updated user');
                }

                // CRITICAL FIX for Issue #57: Override the original_action_hash 
                // createEnhancedUIUser incorrectly sets it to the update record hash
                const updatedUser: UIUser = {
                  ...baseUser,
                  original_action_hash: existingUser.original_action_hash, // ← PRESERVE original creation hash  
                  previous_action_hash: record.signed_action.hashed.hash    // ← Use new update hash
                };

                // DEBUG: Log the hash preservation
                console.log('✅ [updateCurrentUser] Hash preservation:', {
                  before_original: existingUser.original_action_hash?.toString(),
                  before_previous: existingUser.previous_action_hash?.toString(),
                  after_original: updatedUser.original_action_hash?.toString(),
                  after_previous: updatedUser.previous_action_hash?.toString(),
                  baseUser_original: baseUser.original_action_hash?.toString(),
                  record_hash: record.signed_action.hashed.hash.toString()
                });

                // This ensures subsequent getLatestUser calls fetch fresh data from DHT
                // instead of returning stale cached data
                E.runSync(cache.delete(existingUser.original_action_hash!.toString()));

                // Set updated user immediately and emit events
                currentUser = updatedUser;
                syncCacheToState(updatedUser, 'update');
                eventEmitters.emitUpdated(updatedUser);

                return updatedUser;
              })
            );
          }),
          E.orElse(() => E.succeed(null)),
          E.catchAll((error) =>
            E.fail(
              UserError.fromError(
                error,
                USER_CONTEXTS.UPDATE_USER,
                currentUser?.original_action_hash?.toString()
              )
            )
          )
        )
      )(setters);

    const getAcceptedUsers = (): E.Effect<UIUser[], UserError> =>
      userEntityFetcher(
        () =>
          pipe(
            usersService.getAcceptedUsersLinks(),
            E.flatMap((links) =>
              E.all(
                links.map((link) =>
                  pipe(
                    getLatestUser(link.target),
                    E.flatMap((user) => {
                      if (!user) return E.succeed(null);
                      return pipe(
                        administrationStore.getLatestStatusForEntity(
                          link.target,
                          AdministrationEntity.Users
                        ),
                        E.map((status) => ({ ...user, status: status || undefined }) as UIUser)
                      );
                    })
                  )
                )
              )
            ),
            E.map((users) => {
              const validUsers = users.filter((user): user is UIUser => user !== null);
              validUsers.forEach((user) => {
                const userHash = user.original_action_hash;
                if (userHash) {
                  E.runSync(cache.set(userHash.toString(), user));
                  syncCacheToState(user, 'add');
                }
              });
              return validUsers;
            }),
            E.catchAll((error) => {
              const errorMessage = String(error);
              if (errorMessage.includes('Client not connected')) {
                console.warn('Holochain client not connected, returning empty users array');
                return E.succeed([]);
              }
              return E.fail(UserError.fromError(error, USER_CONTEXTS.GET_ACCEPTED_USERS));
            })
          ),
        {
          targetArray: acceptedUsers,
          errorContext: USER_CONTEXTS.GET_ACCEPTED_USERS,
          setters
        }
      );

    const getUserStatusLink = (userHash: ActionHash): E.Effect<Link | null, UserError> =>
      pipe(
        usersService.getUserStatusLink(userHash),
        E.catchAll((error) =>
          E.fail(UserError.fromError(error, USER_CONTEXTS.GET_USER_STATUS, userHash.toString()))
        )
      );

    const getUsersByActionHashes = (actionHashes: ActionHash[]): E.Effect<UIUser[], UserError> =>
      withLoadingState(() =>
        pipe(
          E.all(actionHashes.map((hash) => getUserByActionHash(hash))),
          E.map((users) => users.filter((user): user is UIUser => user !== null)),
          E.catchAll((error) => E.fail(UserError.fromError(error, USER_CONTEXTS.GET_USER_BY_HASH)))
        )
      )(setters);

    const refresh = (): E.Effect<void, UserError> =>
      withLoadingState(() =>
        pipe(
          E.all([refreshCurrentUser(), getAcceptedUsers()]),
          E.asVoid,
          E.catchAll((error) => E.fail(UserError.fromError(error, USER_CONTEXTS.GET_CURRENT_USER)))
        )
      )(setters);

    const getUserAgents = (actionHash: ActionHash): E.Effect<AgentPubKey[], UserError> =>
      pipe(
        usersService.getUserAgents(actionHash),
        E.catchAll((error) =>
          E.fail(UserError.fromError(error, USER_CONTEXTS.GET_USER_AGENTS, actionHash.toString()))
        )
      );

    const getUserByAgentPubKey = (agentPubKey: AgentPubKey): E.Effect<UIUser | null, UserError> =>
      withLoadingState(() =>
        pipe(
          usersService.getAgentUser(agentPubKey),
          E.flatMap((links) =>
            links.length > 0 ? getLatestUser(links[0].target) : E.succeed(null)
          ),
          E.catchAll((error) => E.fail(UserError.fromError(error, USER_CONTEXTS.GET_AGENT_USER)))
        )
      )(setters);

    // ===== STORE INTERFACE =====

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

const usersStore: UsersStore = pipe(
  createUsersStore(),
  E.provide(UsersServiceLive),
  E.provide(CacheServiceLive),
  E.provide(HolochainClientLive),
  E.runSync
);

export default usersStore;
