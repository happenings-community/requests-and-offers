import type { ActionHash, AgentPubKey, Record, Link } from '@holochain/client';
import { decode } from '@msgpack/msgpack';
import {
  AdministrationServiceTag,
  AdministrationServiceLive,
  type AdministrationService
} from '$lib/services/zomes/administration.service';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import {
  HolochainClientLive,
  HolochainClientServiceTag,
  type HolochainClientService
} from '$lib/services/holochainClient.service';
import { AdministrationStoreError } from '$lib/errors/administration.errors';
import { CacheNotFoundError } from '$lib/errors';
import { storeEventBus } from '$lib/stores/storeEvents';
import { Effect as E, pipe } from 'effect';
import type { UIUser, UIOrganization, UIStatus, Revision } from '$lib/types/ui';
import type { StatusInDHT } from '$lib/types/holochain';
import { AdministrationEntity } from '$lib/types/holochain';
import usersStore, { createUsersStore } from '$lib/stores/users.store.svelte';
import { UsersServiceLive, UsersServiceTag } from '$lib/services/zomes/users.service';
import organizationsStore from '$lib/stores/organizations.store.svelte';
import {
  CacheServiceLive as UsersCacheServiceLive,
  CacheServiceTag as UsersCacheServiceTag
} from '$lib/utils/cache.svelte';
import type { UserInDHT } from '$lib/types/holochain';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const ERROR_CONTEXTS = {
  GET_ALL_USERS: 'Failed to get all users',
  GET_ALL_ORGANIZATIONS: 'Failed to get all organizations',
  REGISTER_ADMINISTRATOR: 'Failed to register administrator',
  ADD_ADMINISTRATOR: 'Failed to add administrator',
  REMOVE_ADMINISTRATOR: 'Failed to remove administrator',
  CHECK_ADMINISTRATOR: 'Failed to check administrator status',
  GET_ADMINISTRATORS: 'Failed to get administrators',
  CREATE_STATUS: 'Failed to create status',
  GET_STATUS: 'Failed to get status',
  UPDATE_STATUS: 'Failed to update status',
  GET_STATUS_REVISIONS: 'Failed to get status revisions',
  APPROVE_USER: 'Failed to approve user',
  REJECT_USER: 'Failed to reject user',
  APPROVE_ORGANIZATION: 'Failed to approve organization',
  REJECT_ORGANIZATION: 'Failed to reject organization',
  SUSPEND_USER: 'Failed to suspend user',
  SUSPEND_ORGANIZATION: 'Failed to suspend organization',
  UNSUSPEND_ENTITY: 'Failed to unsuspend entity',
  FETCH_USERS: 'Failed to fetch users',
  FETCH_ORGANIZATIONS: 'Failed to fetch organizations',
  REFRESH: 'Failed to refresh data',
  INITIALIZE: 'Failed to initialize administration store',
  CACHE_OPERATION: 'Cache operation failed',
  GET_ALL_REVISIONS_FOR_STATUS: 'Failed to get all revisions for status'
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type HolochainEntry = {
  Present: {
    entry: Uint8Array;
  };
};

export type AdministrationStore = {
  readonly allUsers: UIUser[];
  readonly allOrganizations: UIOrganization[];
  readonly administrators: UIUser[];
  readonly nonAdministrators: UIUser[];
  readonly allUsersStatusesHistory: Revision[];
  readonly allOrganizationsStatusesHistory: Revision[];
  readonly agentIsAdministrator: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCacheService<UIUser | UIOrganization | UIStatus>;

  initialize: () => E.Effect<void, AdministrationStoreError>;
  fetchAllUsers: () => E.Effect<UIUser[], AdministrationStoreError>;
  fetchAllOrganizations: () => E.Effect<UIOrganization[], AdministrationStoreError>;
  registerNetworkAdministrator: (
    entity_original_action_hash: ActionHash,
    agent_pubkeys: AgentPubKey[]
  ) => E.Effect<boolean, AdministrationStoreError>;
  addNetworkAdministrator: (
    entity_original_action_hash: ActionHash,
    agent_pubkeys: AgentPubKey[]
  ) => E.Effect<boolean, AdministrationStoreError>;
  removeNetworkAdministrator: (
    entity_original_action_hash: ActionHash,
    agent_pubkeys: AgentPubKey[]
  ) => E.Effect<boolean, AdministrationStoreError>;
  checkIfAgentIsAdministrator: () => E.Effect<boolean, AdministrationStoreError>;
  getAllNetworkAdministrators: () => E.Effect<UIUser[], AdministrationStoreError>;
  createStatus: (status: StatusInDHT) => E.Effect<Record, AdministrationStoreError>;
  getLatestStatusForEntity: (
    entity_original_action_hash: ActionHash,
    entity_type: AdministrationEntity
  ) => E.Effect<UIStatus | null, AdministrationStoreError>;
  updateUserStatus: (
    entity_original_action_hash: ActionHash,
    status_original_action_hash: ActionHash,
    status_previous_action_hash: ActionHash,
    new_status: StatusInDHT
  ) => E.Effect<Record, AdministrationStoreError>;
  updateOrganizationStatus: (
    entity_original_action_hash: ActionHash,
    status_original_action_hash: ActionHash,
    status_previous_action_hash: ActionHash,
    new_status: StatusInDHT
  ) => E.Effect<Record, AdministrationStoreError>;
  approveUser: (user: UIUser) => E.Effect<Record, AdministrationStoreError>;
  rejectUser: (user: UIUser) => E.Effect<Record, AdministrationStoreError>;
  approveOrganization: (organization: UIOrganization) => E.Effect<Record, AdministrationStoreError>;
  rejectOrganization: (organization: UIOrganization) => E.Effect<Record, AdministrationStoreError>;
  refreshAll: () => E.Effect<void, AdministrationStoreError>;
  invalidateCache: () => void;
  getAllRevisionsForStatus: (
    entity: UIUser | UIOrganization
  ) => E.Effect<UIStatus[], AdministrationStoreError>;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets the type of entity
 * @param entity - The entity to get the type of
 * @returns The type of entity
 */
const getEntityType = (entity: UIUser | UIOrganization): AdministrationEntity => {
  if ('user_type' in entity) {
    return AdministrationEntity.Users;
  }
  return AdministrationEntity.Organizations;
};

/**
 * Creates a UIStatus from a Record
 * @param record - The record to create the UIStatus from
 * @returns The created UIStatus
 */
const createUIStatusFromRecord = (record: Record): UIStatus => {
  const status = decode((record.entry as any).Present.entry) as StatusInDHT;
  return {
    ...status,
    original_action_hash: record.signed_action.hashed.hash
  };
};

/**
 * Converts StatusInDHT to UIStatus
 * @param status - The status to convert
 * @param timestamp - The current timestamp
 * @param original_action_hash - The original action hash of the status record
 * @param previous_action_hash - The previous action hash of the status record
 * @returns The converted UIStatus
 */
const convertToUIStatus = (
  status: StatusInDHT,
  timestamp?: number,
  original_action_hash?: ActionHash,
  previous_action_hash?: ActionHash
): UIStatus => ({
  status_type: status.status_type,
  reason: status.reason,
  suspended_until: status.suspended_until,
  duration: timestamp ? calculateDuration(status.suspended_until, timestamp) : undefined,
  original_action_hash,
  previous_action_hash
});

/**
 * Calculates suspension duration
 * @param suspendedUntil - The date until which the entity is suspended
 * @param timestamp - The current timestamp
 * @returns The duration in milliseconds
 */
const calculateDuration = (suspendedUntil?: string, timestamp?: number): number | undefined => {
  if (!suspendedUntil || !timestamp) return undefined;
  const until = new Date(suspendedUntil).getTime();
  const now = timestamp;
  return Math.max(0, until - now);
};

/**
 * Higher-order function to wrap operations with loading state management
 * @param operation - The operation to wrap
 * @param setLoading - The function to set the loading state
 * @param setError - The function to set the error state
 * @returns The wrapped operation
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
// DATA FETCHING HELPERS
// ============================================================================

/**
 * Creates a standardized function for fetching and mapping entities with state updates
 * @param serviceMethod - The service method to fetch the entities
 * @param targetArray - The array to store the fetched entities
 * @param errorContext - The error context to use when an error occurs
 * @param setLoading - The function to set the loading state
 * @param setError - The function to set the error state
 * @returns The fetched entities
 */
const createEntityFetcher = <T>(
  serviceMethod: () => E.Effect<T[], unknown>,
  targetArray: T[],
  errorContext: string,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) =>
  withLoadingState(() =>
    pipe(
      serviceMethod(),
      E.map((entities) => {
        targetArray.splice(0, targetArray.length, ...entities);
        return entities;
      }),
      E.catchAll((error) => {
        const errorMessage = String(error);
        if (errorMessage.includes('Client not connected')) {
          console.warn('Holochain client not connected, returning empty array');
          return E.succeed([]);
        }
        return E.fail(AdministrationStoreError.fromError(error, errorContext));
      })
    )
  )(setLoading, setError);

// ============================================================================
// CACHE OPERATIONS HELPERS
// ============================================================================

/**
 * Helper to synchronize cache with local state arrays
 */
const createCacheSyncHelper = (
  allUsers: UIUser[],
  allOrganizations: UIOrganization[],
  administrators: UIUser[],
  nonAdministrators: UIUser[]
) => {
  const syncCacheToState = (
    entity: UIUser | UIOrganization,
    operation: 'add' | 'update' | 'remove'
  ) => {
    if ('user_type' in entity) {
      // It's a UIUser
      const user = entity as UIUser;
      const hash = user.original_action_hash?.toString();
      if (!hash) return;

      switch (operation) {
        case 'add':
        case 'update':
          const existingUserIndex = allUsers.findIndex(
            (u) => u.original_action_hash?.toString() === hash
          );
          if (existingUserIndex !== -1) {
            allUsers[existingUserIndex] = user;
          } else {
            allUsers.push(user);
          }
          break;
        case 'remove':
          const removeUserIndex = allUsers.findIndex(
            (u) => u.original_action_hash?.toString() === hash
          );
          if (removeUserIndex !== -1) {
            allUsers.splice(removeUserIndex, 1);
          }
          break;
      }
    } else {
      // It's a UIOrganization
      const org = entity as UIOrganization;
      const hash = org.original_action_hash?.toString();
      if (!hash) return;

      switch (operation) {
        case 'add':
        case 'update':
          const existingOrgIndex = allOrganizations.findIndex(
            (o) => o.original_action_hash?.toString() === hash
          );
          if (existingOrgIndex !== -1) {
            allOrganizations[existingOrgIndex] = org;
          } else {
            allOrganizations.push(org);
          }
          break;
        case 'remove':
          const removeOrgIndex = allOrganizations.findIndex(
            (o) => o.original_action_hash?.toString() === hash
          );
          if (removeOrgIndex !== -1) {
            allOrganizations.splice(removeOrgIndex, 1);
          }
          break;
      }
    }
  };

  return { syncCacheToState };
};

// ============================================================================
// EVENT EMISSION HELPERS
// ============================================================================

/**
 * Creates standardized event emission helpers
 */
const createEventEmitters = () => {
  const emitUserStatusUpdated = (user: UIUser): void => {
    try {
      storeEventBus.emit('user:status:updated', { user });
    } catch (error) {
      console.error('Failed to emit user:status:updated event:', error);
    }
  };

  const emitOrganizationStatusUpdated = (organization: UIOrganization): void => {
    try {
      storeEventBus.emit('organization:status:updated', { organization });
    } catch (error) {
      console.error('Failed to emit organization:status:updated event:', error);
    }
  };

  const emitAdministratorAdded = (administrator: UIUser): void => {
    try {
      storeEventBus.emit('administrator:added', { administrator });
    } catch (error) {
      console.error('Failed to emit administrator:added event:', error);
    }
  };

  const emitAdministratorRemoved = (administratorHash: ActionHash): void => {
    try {
      storeEventBus.emit('administrator:removed', { administratorHash });
    } catch (error) {
      console.error('Failed to emit administrator:removed event:', error);
    }
  };

  return {
    emitUserStatusUpdated,
    emitOrganizationStatusUpdated,
    emitAdministratorAdded,
    emitAdministratorRemoved
  };
};

// ============================================================================
// STATUS MANAGEMENT HELPERS
// ============================================================================

/**
 * Creates helper for status management operations
 */
const createStatusManager = (cache: EntityCacheService<UIUser | UIOrganization | UIStatus>) => {
  const updateEntityWithStatus = (
    entity: UIUser | UIOrganization,
    status: UIStatus
  ): UIUser | UIOrganization => {
    const updatedEntity = { ...entity, status };
    if (entity.original_action_hash) {
      E.runSync(cache.set(entity.original_action_hash.toString(), updatedEntity));
    }
    return updatedEntity;
  };

  return { updateEntityWithStatus };
};

// ============================================================================
// ADMINISTRATOR MANAGEMENT HELPERS
// ============================================================================

/**
 * Creates helper for administrator management operations
 */
const createAdministratorManager = (
  administrators: UIUser[],
  nonAdministrators: UIUser[],
  allUsers: UIUser[]
) => {
  const updateAdministratorLists = (): void => {
    nonAdministrators.splice(0, nonAdministrators.length);

    // Create set of administrator hashes for quick lookup
    const adminHashes = new Set(
      administrators.map((admin) => admin.original_action_hash?.toString())
    );

    // Filter non-administrators from all users
    const nonAdmins = allUsers.filter((user) => {
      const userHash = user.original_action_hash?.toString();
      return userHash && !adminHashes.has(userHash);
    });

    nonAdministrators.push(...nonAdmins);
  };

  return { updateAdministratorLists };
};

// ============================================================================
// STORE FACTORY FUNCTION
// ============================================================================

export const createAdministrationStore = (): E.Effect<
  AdministrationStore,
  never,
  AdministrationServiceTag | CacheServiceTag | HolochainClientServiceTag
> =>
  E.gen(function* () {
    const administrationService = yield* AdministrationServiceTag;
    const cacheService = yield* CacheServiceTag;
    const holochainClientService = yield* HolochainClientServiceTag;

    // ========================================================================
    // STATE INITIALIZATION
    // ========================================================================
    const allUsers: UIUser[] = $state([]);
    const allOrganizations: UIOrganization[] = $state([]);
    const administrators: UIUser[] = $state([]);
    const nonAdministrators: UIUser[] = $state([]);
    const allUsersStatusesHistory: Revision[] = $state([]);
    const allOrganizationsStatusesHistory: Revision[] = $state([]);
    let agentIsAdministrator: boolean = $state(false);
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
      allUsers,
      allOrganizations,
      administrators,
      nonAdministrators
    );

    const {
      emitUserStatusUpdated,
      emitOrganizationStatusUpdated,
      emitAdministratorAdded,
      emitAdministratorRemoved
    } = createEventEmitters();

    const { updateAdministratorLists } = createAdministratorManager(
      administrators,
      nonAdministrators,
      allUsers
    );

    // Create cache using the cache service
    const cache = yield* cacheService.createEntityCache<UIUser | UIOrganization | UIStatus>(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      (key: string) => E.fail(new CacheNotFoundError({ key })) // Simple fallback for mixed cache
    );

    const { updateEntityWithStatus } = createStatusManager(cache);

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
      allUsers.length = 0;
      allOrganizations.length = 0;
      administrators.length = 0;
      nonAdministrators.length = 0;
      allUsersStatusesHistory.length = 0;
      allOrganizationsStatusesHistory.length = 0;
      agentIsAdministrator = false;
      setError(null);
    };

    // ========================================================================
    // STORE METHODS
    // ========================================================================

    const initialize = (): E.Effect<void, AdministrationStoreError> =>
      withLoadingState(() =>
        pipe(
          E.all([fetchAllUsers(), fetchAllOrganizations()]),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.INITIALIZE))
          )
        )
      )(setLoading, setError);

    const fetchAllUsers = (): E.Effect<UIUser[], AdministrationStoreError> =>
      createEntityFetcher(
        () =>
          pipe(
            administrationService.getAllUsersLinks(),
            E.flatMap((links) =>
              E.all(
                links.map((link) =>
                  pipe(
                    usersStore.getLatestUser(link.target),
                    E.flatMap((user) => {
                      if (!user) return E.succeed(null);
                      return pipe(
                        getLatestStatusForEntity(link.target, AdministrationEntity.Users),
                        E.map((status) => ({ ...user, status: status || undefined }) as UIUser),
                        E.catchAll((error) => {
                          // Return user without status rather than null if status fetch fails
                          return E.succeed({ ...user, status: undefined } as UIUser);
                        })
                      );
                    }),
                    E.catchAll(() => E.succeed(null))
                  )
                )
              )
            ),
            E.map((users) => users.filter((u): u is UIUser => u !== null)),
            E.catchAll((error) =>
              E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.FETCH_USERS))
            )
          ),
        allUsers,
        ERROR_CONTEXTS.FETCH_USERS,
        setLoading,
        setError
      );

    const fetchAllOrganizations = (): E.Effect<UIOrganization[], AdministrationStoreError> =>
      createEntityFetcher(
        () =>
          pipe(
            administrationService.getAllOrganizationsLinks(),
            E.flatMap((links) =>
              E.all(
                links.map((link) =>
                  pipe(
                    organizationsStore.getLatestOrganization(link.target),
                    E.flatMap((organization) => {
                      if (!organization) return E.succeed(null);
                      return pipe(
                        getLatestStatusForEntity(link.target, AdministrationEntity.Organizations),
                        E.map(
                          (status) =>
                            ({ ...organization, status: status || undefined }) as UIOrganization
                        ),
                        E.catchAll((error) => {
                          // Return organization without status rather than null if status fetch fails
                          return E.succeed({
                            ...organization,
                            status: undefined
                          } as UIOrganization);
                        })
                      );
                    }),
                    E.catchAll(() => E.succeed(null))
                  )
                )
              )
            ),
            E.map((organizations) => organizations.filter((o): o is UIOrganization => o !== null)),
            E.catchAll((error) =>
              E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.FETCH_ORGANIZATIONS))
            )
          ),
        allOrganizations,
        ERROR_CONTEXTS.FETCH_ORGANIZATIONS,
        setLoading,
        setError
      );

    const registerNetworkAdministrator = (
      entity_original_action_hash: ActionHash,
      agent_pubkeys: AgentPubKey[]
    ): E.Effect<boolean, AdministrationStoreError> =>
      withLoadingState(() =>
        pipe(
          administrationService.registerNetworkAdministrator(
            entity_original_action_hash,
            agent_pubkeys
          ),
          E.tap((success) => {
            if (success) {
              updateAdministratorLists();
            }
          }),
          E.catchAll((error) =>
            E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.REGISTER_ADMINISTRATOR))
          )
        )
      )(setLoading, setError);

    const addNetworkAdministrator = (
      entity_original_action_hash: ActionHash,
      agent_pubkeys: AgentPubKey[]
    ): E.Effect<boolean, AdministrationStoreError> =>
      withLoadingState(() =>
        pipe(
          administrationService.addAdministrator({
            entity: AdministrationEntity.Network,
            entity_original_action_hash,
            agent_pubkeys
          }),
          E.tap((success) => {
            if (success) {
              updateAdministratorLists();
            }
          }),
          E.catchAll((error) =>
            E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.ADD_ADMINISTRATOR))
          )
        )
      )(setLoading, setError);

    const removeNetworkAdministrator = (
      entity_original_action_hash: ActionHash,
      agent_pubkeys: AgentPubKey[]
    ): E.Effect<boolean, AdministrationStoreError> =>
      withLoadingState(() =>
        pipe(
          administrationService.removeAdministrator({
            entity: AdministrationEntity.Network,
            entity_original_action_hash,
            agent_pubkeys
          }),
          E.tap((success) => {
            if (success) {
              updateAdministratorLists();
            }
          }),
          E.catchAll((error) =>
            E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.REMOVE_ADMINISTRATOR))
          )
        )
      )(setLoading, setError);

    const checkIfAgentIsAdministrator = (): E.Effect<boolean, AdministrationStoreError> =>
      withLoadingState(() =>
        pipe(
          holochainClientService.getClientEffect(),
          E.flatMap((client) =>
            client ? E.succeed(client.myPubKey) : E.fail(new Error('Client not connected'))
          ),
          E.flatMap((agentPubKey) =>
            administrationService.checkIfAgentIsAdministrator({
              entity: AdministrationEntity.Network,
              agent_pubkey: agentPubKey
            })
          ),
          E.tap((isAdmin) => {
            agentIsAdministrator = isAdmin;
          }),
          E.catchAll((error) =>
            E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.CHECK_ADMINISTRATOR))
          )
        )
      )(setLoading, setError);

    const getAllNetworkAdministrators = (): E.Effect<UIUser[], AdministrationStoreError> =>
      withLoadingState(() =>
        pipe(
          administrationService.getAllAdministratorsLinks(AdministrationEntity.Network),
          E.flatMap((links) =>
            E.all(
              links.map((link) => {
                const entityHash = link.target as ActionHash;
                return pipe(
                  usersStore.getUserAgents(entityHash),
                  E.flatMap((agents) => {
                    const firstAgent = agents[0];
                    if (!firstAgent) {
                      return E.succeed(null as UIUser | null);
                    }
                    return usersStore.getUserByAgentPubKey(firstAgent);
                  }),
                  E.catchAll(() => E.succeed(null)),
                  E.map(
                    (user) =>
                      user ||
                      ({
                        // Fallback minimal placeholder
                        original_action_hash: entityHash,
                        user_type: 'advocate',
                        name: `Admin ${entityHash.toString().substring(0, 6)}...`,
                        nickname: `Admin ${entityHash.toString().substring(0, 6)}...`,
                        email: 'admin@example.com'
                      } as UIUser)
                  )
                );
              })
            )
          ),
          E.map((users) => users.filter((u): u is UIUser => u !== null)),
          E.tap((admins) => {
            administrators.splice(0, administrators.length, ...admins);
            updateAdministratorLists();
          }),
          E.catchAll((error) =>
            E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.GET_ADMINISTRATORS))
          )
        )
      )(setLoading, setError);

    const createStatus = (status: StatusInDHT): E.Effect<Record, AdministrationStoreError> =>
      withLoadingState(() =>
        pipe(
          administrationService.createStatus(status),
          E.catchAll((error) =>
            E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.CREATE_STATUS))
          )
        )
      )(setLoading, setError);

    const getLatestStatusForEntity = (
      entity_original_action_hash: ActionHash,
      entity_type: AdministrationEntity
    ): E.Effect<UIStatus | null, AdministrationStoreError> =>
      pipe(
        administrationService.getLatestStatusRecordForEntity({
          entity: entity_type,
          entity_original_action_hash
        }),
        E.map((record) => {
          if (!record) return null;
          const decodedStatus = decode(
            (record.entry as HolochainEntry).Present.entry
          ) as StatusInDHT;
          const action = record.signed_action.hashed.content;
          // For status updates: previous_action_hash should be the current status action hash
          // This is the action hash of the status entry that would be updated
          const currentStatusActionHash = record.signed_action.hashed.hash;

          return convertToUIStatus(
            decodedStatus,
            action.timestamp,
            currentStatusActionHash, // This is the "original" action hash for this status
            currentStatusActionHash // This is also the "previous" action hash for updates
          );
        }),
        E.catchAll((error) =>
          E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.GET_STATUS))
        )
      );

    const updateUserStatus = (
      entity_original_action_hash: ActionHash,
      status_original_action_hash: ActionHash,
      status_previous_action_hash: ActionHash,
      new_status: StatusInDHT
    ): E.Effect<Record, AdministrationStoreError> =>
      withLoadingState(() =>
        pipe(
          administrationService.updateEntityStatus({
            entity: AdministrationEntity.Users,
            entity_original_action_hash,
            status_original_action_hash,
            status_previous_action_hash,
            new_status: {
              status_type: new_status.status_type,
              reason: new_status.reason,
              suspended_until: new_status.suspended_until,
              created_at: Date.now(),
              updated_at: Date.now()
            }
          }),
          E.catchAll((error) =>
            E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.UPDATE_STATUS))
          )
        )
      )(setLoading, setError);

    const updateOrganizationStatus = (
      entity_original_action_hash: ActionHash,
      status_original_action_hash: ActionHash,
      status_previous_action_hash: ActionHash,
      new_status: StatusInDHT
    ): E.Effect<Record, AdministrationStoreError> =>
      withLoadingState(() =>
        pipe(
          administrationService.updateEntityStatus({
            entity: AdministrationEntity.Organizations,
            entity_original_action_hash,
            status_original_action_hash,
            status_previous_action_hash,
            new_status: {
              status_type: new_status.status_type,
              reason: new_status.reason,
              suspended_until: new_status.suspended_until,
              created_at: Date.now(),
              updated_at: Date.now()
            }
          }),
          E.catchAll((error) =>
            E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.UPDATE_STATUS))
          )
        )
      )(setLoading, setError);

    const approveUser = (user: UIUser): E.Effect<Record, AdministrationStoreError> =>
      withLoadingState(() =>
        pipe(
          E.succeed(user),
          E.flatMap((u) => {
            if (!u.status?.original_action_hash) {
              return E.fail(new Error('User status information missing'));
            }
            // For status updates, previous_action_hash should be the current status action hash
            // If there's no previous_action_hash, we're updating the original status entry
            const previousActionHash =
              u.status.previous_action_hash || u.status.original_action_hash;

            return updateUserStatus(
              u.original_action_hash!,
              u.status.original_action_hash,
              previousActionHash,
              { status_type: 'accepted' }
            );
          }),
          E.tap(() => {
            emitUserStatusUpdated(user);
            invalidateCache();
          }),
          E.catchAll((error) =>
            E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.APPROVE_USER))
          )
        )
      )(setLoading, setError);

    const rejectUser = (user: UIUser): E.Effect<Record, AdministrationStoreError> =>
      withLoadingState(() =>
        pipe(
          E.succeed(user),
          E.flatMap((u) => {
            if (!u.status?.original_action_hash) {
              return E.fail(new Error('User status information missing'));
            }
            // For the first status update, previous_action_hash can be the same as original_action_hash
            const previousActionHash =
              u.status.previous_action_hash || u.status.original_action_hash;
            return updateUserStatus(
              u.original_action_hash!,
              u.status.original_action_hash,
              previousActionHash,
              { status_type: 'rejected' }
            );
          }),
          E.tap(() => {
            emitUserStatusUpdated(user);
            invalidateCache();
          }),
          E.catchAll((error) =>
            E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.REJECT_USER))
          )
        )
      )(setLoading, setError);

    const approveOrganization = (
      organization: UIOrganization
    ): E.Effect<Record, AdministrationStoreError> =>
      withLoadingState(() =>
        pipe(
          E.succeed(organization),
          E.flatMap((org) => {
            if (!org.status?.original_action_hash) {
              return E.fail(new Error('Organization status information missing'));
            }
            // For the first status update, previous_action_hash can be the same as original_action_hash
            const previousActionHash =
              org.status.previous_action_hash || org.status.original_action_hash;
            return updateOrganizationStatus(
              org.original_action_hash!,
              org.status.original_action_hash,
              previousActionHash,
              { status_type: 'accepted' }
            );
          }),
          E.tap(() => {
            emitOrganizationStatusUpdated(organization);
            invalidateCache();
          }),
          E.catchAll((error) =>
            E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.APPROVE_ORGANIZATION))
          )
        )
      )(setLoading, setError);

    const rejectOrganization = (
      organization: UIOrganization
    ): E.Effect<Record, AdministrationStoreError> =>
      withLoadingState(() =>
        pipe(
          E.succeed(organization),
          E.flatMap((org) => {
            if (!org.status?.original_action_hash) {
              return E.fail(new Error('Organization status information missing'));
            }
            // For the first status update, previous_action_hash can be the same as original_action_hash
            const previousActionHash =
              org.status.previous_action_hash || org.status.original_action_hash;
            return updateOrganizationStatus(
              org.original_action_hash!,
              org.status.original_action_hash,
              previousActionHash,
              { status_type: 'rejected' }
            );
          }),
          E.tap(() => {
            emitOrganizationStatusUpdated(organization);
            invalidateCache();
          }),
          E.catchAll((error) =>
            E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.REJECT_ORGANIZATION))
          )
        )
      )(setLoading, setError);

    const refreshAll = (): E.Effect<void, AdministrationStoreError> =>
      withLoadingState(() =>
        pipe(
          E.all([fetchAllUsers(), fetchAllOrganizations(), getAllNetworkAdministrators()]),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(AdministrationStoreError.fromError(error, ERROR_CONTEXTS.REFRESH))
          )
        )
      )(setLoading, setError);

    const getAllRevisionsForStatus = (
      entity: UIUser | UIOrganization
    ): E.Effect<UIStatus[], AdministrationStoreError> =>
      pipe(
        E.succeed(entity),
        E.filterOrFail(
          (entity): entity is typeof entity & { original_action_hash: ActionHash } =>
            !!entity.original_action_hash,
          () =>
            AdministrationStoreError.fromError(
              new Error('Entity has no original_action_hash'),
              ERROR_CONTEXTS.GET_ALL_REVISIONS_FOR_STATUS
            )
        ),
        E.flatMap((entity) =>
          getLatestStatusForEntity(entity.original_action_hash, getEntityType(entity))
        ),
        E.filterOrFail(
          (status): status is UIStatus & { original_action_hash: ActionHash } =>
            !!status?.original_action_hash,
          () =>
            AdministrationStoreError.fromError(
              new Error('Status record not found'),
              ERROR_CONTEXTS.GET_ALL_REVISIONS_FOR_STATUS
            )
        ),
        E.flatMap((status) => administrationService.get_all_revisions(status.original_action_hash)),
        E.map((records) => records.map(createUIStatusFromRecord)),
        E.mapError((e) =>
          AdministrationStoreError.fromError(e, ERROR_CONTEXTS.GET_ALL_REVISIONS_FOR_STATUS)
        )
      );

    // ========================================================================
    // STORE INTERFACE RETURN
    // ========================================================================

    return {
      get allUsers() {
        return allUsers;
      },
      get allOrganizations() {
        return allOrganizations;
      },
      get administrators() {
        return administrators;
      },
      get nonAdministrators() {
        return nonAdministrators;
      },
      get allUsersStatusesHistory() {
        return allUsersStatusesHistory;
      },
      get allOrganizationsStatusesHistory() {
        return allOrganizationsStatusesHistory;
      },
      get agentIsAdministrator() {
        return agentIsAdministrator;
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

      initialize,
      fetchAllUsers,
      fetchAllOrganizations,
      registerNetworkAdministrator,
      addNetworkAdministrator,
      removeNetworkAdministrator,
      checkIfAgentIsAdministrator,
      getAllNetworkAdministrators,
      createStatus,
      getLatestStatusForEntity,
      updateUserStatus,
      updateOrganizationStatus,
      approveUser,
      rejectUser,
      approveOrganization,
      rejectOrganization,
      refreshAll,
      invalidateCache,
      getAllRevisionsForStatus
    };
  });

// ============================================================================
// STORE INSTANCE CREATION
// ============================================================================

const administrationStore: AdministrationStore = pipe(
  createAdministrationStore(),
  E.provide(AdministrationServiceLive),
  E.provide(CacheServiceLive),
  E.provide(HolochainClientLive),
  E.runSync
);

export default administrationStore;
