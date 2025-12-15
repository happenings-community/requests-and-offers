import type { ActionHash, AgentPubKey, Link } from '@holochain/client';
import { UsersServiceTag, UsersServiceLive } from '$lib/services/zomes/users.service';
import { AdministrationServiceLive } from '$lib/services/zomes/administration.service';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import {
  HolochainClientServiceLive,
  HolochainClientServiceTag
} from '$lib/services/HolochainClientService.svelte';
import { UserError, USER_CONTEXTS } from '$lib/errors';
import { CacheNotFoundError } from '$lib/errors';
import { Effect as E, pipe } from 'effect';
import type { UIUser, UIStatus } from '$lib/types/ui';
import type { UserInDHT } from '$lib/schemas/users.schemas';
import { AdministrationEntity } from '$lib/types/holochain';
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

  createUser: (input: UserInDHT) => E.Effect<UIUser, UserError>;
  getLatestUser: (originalActionHash: ActionHash) => E.Effect<UIUser | null, UserError>;
  getUserByActionHash: (actionHash: ActionHash) => E.Effect<UIUser | null, UserError>;
  setCurrentUser: (user: UIUser) => E.Effect<void, UserError>;
  refreshCurrentUser: () => E.Effect<UIUser | null, UserError>;
  updateCurrentUser: (input: UserInDHT) => E.Effect<UIUser | null, UserError>;
  getAcceptedUsers: () => E.Effect<UIUser[], UserError>;
  getUserStatusLink: (userHash: ActionHash) => E.Effect<Link | null, UserError>;
  getUsersByActionHashes: (actionHashes: ActionHash[]) => E.Effect<UIUser[], UserError>;
  refresh: () => E.Effect<void, UserError>;
  getUserAgents: (actionHash: ActionHash) => E.Effect<AgentPubKey[], UserError>;
  getUserByAgentPubKey: (agentPubKey: AgentPubKey) => E.Effect<UIUser | null, UserError>;
  getNetworkPeers: () => E.Effect<string[], UserError>;
  invalidateCache: () => void;
};

// ============================================================================
// ENTITY CREATION HELPERS
// ============================================================================

/**
 * Creates UIUser from record with additional processing
 * This handles status and service type relationships using the standardized helper pattern
 */
const createUIUser = createUIEntityFromRecord<UserInDHT, UIUser>(
  (entry, actionHash, timestamp, additionalData) => {
    const status = additionalData?.status as UIStatus;

    return {
      ...entry,
      original_action_hash: actionHash,
      previous_action_hash: actionHash,
      status,
      created_at: timestamp,
      updated_at: timestamp
    };
  }
);

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
  UsersServiceTag | CacheServiceTag | HolochainClientServiceTag
> =>
  E.gen(function* () {
    const usersService = yield* UsersServiceTag;
    const holochainClient = yield* HolochainClientServiceTag;
    const cacheService = yield* CacheServiceTag;

    // ========================================================================
    // STATE INITIALIZATION
    // ========================================================================
    let currentUser = $state<UIUser | null>(null);
    const acceptedUsers: UIUser[] = $state([]);
    let loading: boolean = $state(false);
    let error: string | null = $state(null);

    // ========================================================================
    // RACE CONDITION PREVENTION
    // ========================================================================
    let isRefreshing: boolean = false;

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

    const createUser = (input: UserInDHT): E.Effect<UIUser, UserError> =>
      withLoadingState(() =>
        pipe(
          usersService.createUser(input),
          E.map((record) => {
            const newUser = createUIUser(record, {});

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
                const user = createUIUser(record, { status: status || undefined });
                if (user) {
                  // createEnhancedUIUser sets it to the record hash, but we need the creation hash
                  const correctedUser: UIUser = {
                    ...user,
                    original_action_hash: originalActionHash // ← Use the parameter, not the record hash
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
      pipe(
        E.sync(() => {
          // Prevent multiple concurrent refresh calls
          if (isRefreshing) {
            console.log(
              '🔄 [refreshCurrentUser] Refresh already in progress, returning current user'
            );
            return 'already_running';
          }

          isRefreshing = true;
          console.log('🔄 [refreshCurrentUser] Starting new refresh');
          return 'start_refresh';
        }),
        E.flatMap((status) => {
          if (status === 'already_running') {
            // If already running, return current user or null without resetting flag
            return E.succeed(currentUser);
          }

          // Perform the actual refresh with proper error handling
          return withLoadingState(() =>
            pipe(
              // Get the current agent's public key from Holochain via centralized runtime (Promise API)
              E.tryPromise({
                try: async () => await holochainClient.getAppInfo(),
                catch: (error) => {
                  console.error('❌ [refreshCurrentUser] Failed to get app info:', error);
                  return UserError.fromError(error, USER_CONTEXTS.GET_CURRENT_USER);
                }
              }),
              E.flatMap((appInfo) => {
                if (!appInfo?.agent_pub_key) {
                  console.log('ℹ️ [refreshCurrentUser] No agent pub key found');
                  return E.succeed(null);
                }

                console.log('🔍 [refreshCurrentUser] Found agent pub key, looking up user links');

                // Get the user profile links for this agent
                return pipe(
                  usersService.getAgentUser(appInfo.agent_pub_key),
                  E.flatMap((links) => {
                    if (links.length === 0) {
                      console.log('ℹ️ [refreshCurrentUser] No user links found');
                      return E.succeed(null);
                    }

                    console.log(
                      '🔍 [refreshCurrentUser] Found user links, fetching latest user record'
                    );

                    // Get the latest user record
                    return pipe(
                      getLatestUser(links[0].target),
                      E.flatMap((user) => {
                        if (!user) {
                          console.log('ℹ️ [refreshCurrentUser] No user record found');
                          return E.succeed(null);
                        }

                        console.log('🔍 [refreshCurrentUser] Found user record, fetching status');

                        return pipe(
                          administrationStore.getLatestStatusForEntity(
                            links[0].target,
                            AdministrationEntity.Users
                          ),
                          E.provide(AdministrationServiceLive),
                          E.provide(CacheServiceLive),
                          E.provide(HolochainClientServiceLive),
                          E.map((status) => {
                            const userWithStatus = {
                              ...user,
                              status: status || undefined
                            } as UIUser;
                            console.log(
                              '✅ [refreshCurrentUser] Successfully fetched user with status:',
                              status?.status_type || 'none'
                            );
                            return userWithStatus;
                          })
                        );
                      }),
                      E.tap((user) => {
                        // Set the current user and emit sync event
                        if (user) {
                          currentUser = user;
                          eventEmitters.emitStatusChanged?.(user);
                          console.log('✅ [refreshCurrentUser] User updated and event emitted');
                        }
                      })
                    );
                  }),
                  E.catchAll((error) => {
                    console.error('❌ [refreshCurrentUser] Error in user lookup:', error);
                    return E.fail(UserError.fromError(error, USER_CONTEXTS.GET_CURRENT_USER));
                  })
                );
              }),
              E.catchAll((error) => {
                console.error('❌ [refreshCurrentUser] Error in refresh process:', error);
                return E.fail(UserError.fromError(error, USER_CONTEXTS.GET_CURRENT_USER));
              })
            )
          )(setters);
        }),
        E.tap((user) => {
          console.log('✅ [refreshCurrentUser] Refresh completed, user:', user?.nickname || 'null');
        }),
        E.ensuring(
          E.sync(() => {
            // Reset the refresh flag after completion (but not loading state, handled by withLoadingState)
            isRefreshing = false;
            console.log('🔄 [refreshCurrentUser] Refresh flag reset');
          })
        )
      );

    const updateCurrentUser = (input: UserInDHT): E.Effect<UIUser | null, UserError> =>
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
              user_data: input
            });

            return pipe(
              usersService.updateUser(
                existingUser.original_action_hash,
                existingUser.previous_action_hash,
                input
              ),
              E.map((record) => {
                // Create user with enhanced function first
                const baseUser = createUIUser(record, {
                  status: existingUser.status
                });

                if (!baseUser) {
                  throw new Error('Failed to create updated user');
                }

                // CRITICAL FIX for Issue #57: Override the original_action_hash
                // createEnhancedUIUser incorrectly sets it to the update record hash
                const updatedUser: UIUser = {
                  ...baseUser,
                  original_action_hash: existingUser.original_action_hash, // ← PRESERVE original creation hash
                  previous_action_hash: record.signed_action.hashed.hash // ← Use new update hash
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

    /**
     * Get all network peers using Holochain 0.6's getNetworkPeers API
     * Only works in test mode with dev features enabled
     */
    const getNetworkPeers = (): E.Effect<string[], UserError> =>
      E.tryPromise({
        try: () => holochainClient.getNetworkPeers(),
        catch: (error) => UserError.fromError(error, USER_CONTEXTS.GET_NETWORK_PEERS)
      });

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
      getNetworkPeers,
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
  E.provide(HolochainClientServiceLive),
  E.runSync
);

export default usersStore;
