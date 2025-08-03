import type { ActionHash, AgentPubKey, Record as HolochainRecord, Link } from '@holochain/client';
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
import { AdministrationError } from '$lib/errors/administration.errors';
import { CacheNotFoundError } from '$lib/errors';
import { storeEventBus } from '$lib/stores/storeEvents';
import { Effect as E, pipe } from 'effect';

// Import standardized store helpers
import {
  withLoadingState,
  createErrorHandler,
  createGenericCacheSyncHelper,
  createEntityFetcher,
  createStatusAwareEventEmitters,
  createUIEntityFromRecord,
  createStatusTransitionHelper,
  createCacheLookupFunction,
  createEntityCreationHelper,
  processMultipleRecordCollections,
  type CacheableEntity,
  type LoadingStateSetter,
  type EntityStatus
} from '$lib/utils/store-helpers';
import type { UIUser, UIOrganization, UIStatus, Revision } from '$lib/types/ui';
import type { StatusInDHT, StatusType } from '$lib/types/holochain';
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

  initialize: () => E.Effect<void, AdministrationError, HolochainClientServiceTag>;
  fetchAllUsers: () => E.Effect<UIUser[], AdministrationError>;
  fetchAllOrganizations: () => E.Effect<UIOrganization[], AdministrationError>;
  fetchAllUsersStatusHistory: () => E.Effect<void, AdministrationError, never>;
  fetchAllOrganizationsStatusHistory: () => E.Effect<void, AdministrationError, never>;
  registerNetworkAdministrator: (
    entity_original_action_hash: ActionHash,
    agent_pubkeys: AgentPubKey[]
  ) => E.Effect<boolean, AdministrationError>;
  addNetworkAdministrator: (
    entity_original_action_hash: ActionHash,
    agent_pubkeys: AgentPubKey[]
  ) => E.Effect<boolean, AdministrationError>;
  removeNetworkAdministrator: (
    entity_original_action_hash: ActionHash,
    agent_pubkeys: AgentPubKey[]
  ) => E.Effect<boolean, AdministrationError>;
  checkIfAgentIsAdministrator: () => E.Effect<boolean, AdministrationError>;
  getAllNetworkAdministrators: () => E.Effect<UIUser[], AdministrationError>;
  createStatus: (status: StatusInDHT) => E.Effect<HolochainRecord, AdministrationError>;
  getLatestStatusForEntity: (
    entity_original_action_hash: ActionHash,
    entity_type: AdministrationEntity
  ) => E.Effect<UIStatus | null, AdministrationError>;
  updateUserStatus: (
    entity_original_action_hash: ActionHash,
    status_original_action_hash: ActionHash,
    status_previous_action_hash: ActionHash,
    new_status: StatusInDHT
  ) => E.Effect<HolochainRecord, AdministrationError>;
  updateOrganizationStatus: (
    entity_original_action_hash: ActionHash,
    status_original_action_hash: ActionHash,
    status_previous_action_hash: ActionHash,
    new_status: StatusInDHT
  ) => E.Effect<HolochainRecord, AdministrationError>;
  approveUser: (user: UIUser) => E.Effect<HolochainRecord, AdministrationError>;
  rejectUser: (user: UIUser) => E.Effect<HolochainRecord, AdministrationError>;
  suspendUser: (
    user: UIUser,
    reason?: string,
    suspended_until?: string
  ) => E.Effect<HolochainRecord, AdministrationError>;
  unsuspendUser: (user: UIUser) => E.Effect<HolochainRecord, AdministrationError>;
  approveOrganization: (
    organization: UIOrganization
  ) => E.Effect<HolochainRecord, AdministrationError>;
  rejectOrganization: (
    organization: UIOrganization
  ) => E.Effect<HolochainRecord, AdministrationError>;
  suspendOrganization: (
    organization: UIOrganization,
    reason?: string,
    suspended_until?: string
  ) => E.Effect<HolochainRecord, AdministrationError>;
  unsuspendOrganization: (
    organization: UIOrganization
  ) => E.Effect<HolochainRecord, AdministrationError>;
  refreshAll: () => E.Effect<void, AdministrationError, HolochainClientServiceTag>;
  invalidateCache: () => void;
  getAllRevisionsForStatus: (
    entity: UIUser | UIOrganization
  ) => E.Effect<UIStatus[], AdministrationError>;
  getEntityStatusHistory: (
    entity: UIUser | UIOrganization
  ) => E.Effect<Revision[], AdministrationError, never>;
};

// ============================================================================
// ENTITY CREATION HELPERS
// ============================================================================

/**
 * Creates a UIStatus from a Record using standardized helper pattern
 * This demonstrates the use of createUIEntityFromRecord from store-helpers
 */
const createUIStatus = createUIEntityFromRecord<StatusInDHT, UIStatus>(
  (entry, actionHash, timestamp, additionalData) => {
    try {
      // Validate and normalize status_type
      const normalizedStatusType = validateAndNormalizeStatusType(entry.status_type);

      if (normalizedStatusType === null) {
        console.warn(
          `⚠️ Cannot normalize status type "${entry.status_type}" to a valid StatusType`
        );
        // Return default status instead of null
        return {
          status_type: 'pending' as StatusType,
          reason: entry.reason || 'Invalid status type',
          suspended_until: entry.suspended_until || undefined,
          original_action_hash: actionHash,
          created_at: timestamp,
          updated_at: timestamp
        };
      }

      return {
        status_type: normalizedStatusType,
        reason: entry.reason || undefined,
        suspended_until: entry.suspended_until || undefined,
        original_action_hash: actionHash,
        created_at: timestamp,
        updated_at: timestamp
      };
    } catch (error) {
      console.error('💥 Error creating UIStatus from entry:', error);
      // Return default status instead of null
      return {
        status_type: 'pending' as StatusType,
        reason: 'Error parsing status',
        suspended_until: undefined,
        original_action_hash: actionHash,
        created_at: timestamp,
        updated_at: timestamp
      };
    }
  }
);

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Standardized error handler for Administration operations
 */
const handleAdministrationError = createErrorHandler(
  AdministrationError.fromError,
  'Administration operation failed'
);

// ============================================================================
// EVENT EMISSION HELPERS
// ============================================================================

/**
 * Create standardized event emitters for Administration entities
 */
const userEventEmitters = createStatusAwareEventEmitters<UIUser>('user');
const organizationEventEmitters = createStatusAwareEventEmitters<UIOrganization>('organization');

// ============================================================================
// DATA FETCHING HELPERS
// ============================================================================

/**
 * Create standardized entity fetchers for Administration entities
 */
const userEntityFetcher = createEntityFetcher<UIUser, AdministrationError>(
  handleAdministrationError
);

const organizationEntityFetcher = createEntityFetcher<UIOrganization, AdministrationError>(
  handleAdministrationError
);

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
 * @returns The created UIStatus or null if parsing fails
 */
const createUIStatusFromRecord = (record: HolochainRecord): UIStatus | null => {
  try {
    console.log('🔍 createUIStatusFromRecord - raw record:', record);
    console.log('🔍 createUIStatusFromRecord - record.entry:', record.entry);

    if (!record.entry || typeof record.entry !== 'object') {
      console.error('❌ Invalid record entry:', record.entry);
      return null;
    }

    // Handle both Present and ActionNotPresent cases
    let entryData: any;
    const recordEntry = record.entry as any;

    if (recordEntry.Present && recordEntry.Present.entry) {
      entryData = recordEntry.Present.entry;
      console.log('📦 Found Present.entry - entryData:', entryData);
    } else if (recordEntry.entry) {
      entryData = recordEntry.entry;
      console.log('📦 Found direct entry - entryData:', entryData);
    } else {
      console.error('❌ No valid entry found in record. Structure:', recordEntry);
      return null;
    }

    console.log('🔍 entryData before decode (type:', typeof entryData, '):', entryData);

    // Decode MessagePack data
    let decodedData: any;
    try {
      decodedData = decode(entryData);
      console.log('✅ MessagePack decode successful. Type:', typeof decodedData);
      console.log('🔍 Decoded data structure:', decodedData);
      console.log(
        '🔍 Decoded data keys:',
        decodedData && typeof decodedData === 'object' ? Object.keys(decodedData) : 'Not an object'
      );
    } catch (decodeError) {
      console.error('❌ MessagePack decode failed:', decodeError);
      return null;
    }

    // Extract status data with multiple fallback strategies
    let status_type: string = 'unknown';
    let reason: string | undefined = undefined;
    let suspended_until: string | undefined = undefined;

    if (decodedData && typeof decodedData === 'object') {
      // Strategy 1: Direct property access
      if (decodedData.status_type) {
        status_type = String(decodedData.status_type);
        reason = decodedData.reason ? String(decodedData.reason) : undefined;
        suspended_until = decodedData.suspended_until
          ? String(decodedData.suspended_until)
          : undefined;
        console.log('✅ Strategy 1 (direct access) succeeded:', {
          status_type,
          reason,
          suspended_until
        });
      }
      // Strategy 2: Array structure (sometimes MessagePack returns arrays for structs)
      else if (Array.isArray(decodedData) && decodedData.length >= 1) {
        status_type = decodedData[0] ? String(decodedData[0]) : 'unknown';
        reason = decodedData[1] ? String(decodedData[1]) : undefined;
        suspended_until = decodedData[2] ? String(decodedData[2]) : undefined;
        console.log('✅ Strategy 2 (array access) succeeded:', {
          status_type,
          reason,
          suspended_until
        });
      }
      // Strategy 3: Nested object structure
      else if (decodedData.status && typeof decodedData.status === 'object') {
        const statusObj = decodedData.status;
        status_type = statusObj.status_type ? String(statusObj.status_type) : 'unknown';
        reason = statusObj.reason ? String(statusObj.reason) : undefined;
        suspended_until = statusObj.suspended_until ? String(statusObj.suspended_until) : undefined;
        console.log('✅ Strategy 3 (nested object) succeeded:', {
          status_type,
          reason,
          suspended_until
        });
      } else {
        console.warn('⚠️ No strategy succeeded. DecodedData structure:', decodedData);
        console.warn('⚠️ Available properties:', Object.keys(decodedData));
        return null;
      }
    } else {
      console.error('❌ Decoded data is not an object:', typeof decodedData, decodedData);
      return null;
    }

    // Validate and normalize status_type
    const normalizedStatusType = validateAndNormalizeStatusType(status_type);

    // If we can't normalize to a valid status type, return null
    if (normalizedStatusType === null) {
      console.warn(`⚠️ Cannot normalize status type "${status_type}" to a valid StatusType`);
      return null;
    }

    console.log('🎯 Final extracted values:', {
      original_status_type: status_type,
      normalized_status_type: normalizedStatusType,
      reason,
      suspended_until
    });

    const result: UIStatus = {
      status_type: normalizedStatusType,
      reason: reason || undefined,
      suspended_until: suspended_until || undefined,
      original_action_hash: record.signed_action.hashed.hash,
      created_at: record.signed_action.hashed.content.timestamp,
      updated_at: record.signed_action.hashed.content.timestamp
    };

    console.log('🎉 createUIStatusFromRecord - final result:', result);
    return result;
  } catch (error) {
    console.error('💥 Unexpected error in createUIStatusFromRecord:', error);
    return null;
  }
};

/**
 * Validates and normalizes a status type string
 * @param statusType - The status type to validate
 * @returns The normalized status type or null if invalid
 */
const validateAndNormalizeStatusType = (statusType: string): StatusType | null => {
  const validStatusTypes: StatusType[] = [
    'pending',
    'accepted',
    'rejected',
    'suspended temporarily',
    'suspended indefinitely'
  ];
  const normalized = statusType?.toLowerCase()?.trim();

  // Direct match
  if (validStatusTypes.includes(normalized as StatusType)) {
    return normalized as StatusType;
  }

  // Fuzzy matching for common variations
  const fuzzyMatches: Record<string, StatusType> = {
    accept: 'accepted',
    approve: 'accepted',
    approved: 'accepted',
    reject: 'rejected',
    denied: 'rejected',
    deny: 'rejected',
    suspend: 'suspended temporarily',
    suspended: 'suspended temporarily',
    'temp suspended': 'suspended temporarily',
    temporary: 'suspended temporarily',
    indefinite: 'suspended indefinitely',
    indefinitely: 'suspended indefinitely',
    banned: 'suspended indefinitely',
    permanent: 'suspended indefinitely',
    perm: 'suspended indefinitely'
  };

  if (fuzzyMatches[normalized]) {
    console.log(`🔄 Fuzzy matched "${statusType}" to "${fuzzyMatches[normalized]}"`);
    return fuzzyMatches[normalized];
  }

  console.warn(`⚠️ Unknown status type: "${statusType}". Cannot normalize to valid StatusType.`);
  return null;
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

// Note: withLoadingState is now imported from store-helpers

// ============================================================================
// DATA FETCHING HELPERS
// ============================================================================

// Note: createEntityFetcher is now replaced with administrationEntityFetcher from store-helpers

// ============================================================================
// CACHE OPERATIONS HELPERS
// ============================================================================

// Note: Cache sync helper will be replaced with createGenericCacheSyncHelper during store factory creation

// ============================================================================
// EVENT EMISSION HELPERS
// ============================================================================

/**
 * Creates standardized event emission helpers with backward compatibility
 */
const createEventEmitters = () => {
  const emitUserStatusUpdated = (user: UIUser): void => {
    try {
      storeEventBus.emit('user:status:updated', { user });
      userEventEmitters.emitStatusChanged?.(user);
    } catch (error) {
      console.error('Failed to emit user:status:updated event:', error);
    }
  };

  const emitOrganizationStatusUpdated = (organization: UIOrganization): void => {
    try {
      storeEventBus.emit('organization:status:updated', { organization });
      organizationEventEmitters.emitStatusChanged?.(organization);
    } catch (error) {
      console.error('Failed to emit organization:status:updated event:', error);
    }
  };

  const emitAdministratorAdded = (administrator: UIUser): void => {
    try {
      storeEventBus.emit('administrator:added', { administrator });
      userEventEmitters.emitCreated(administrator);
    } catch (error) {
      console.error('Failed to emit administrator:added event:', error);
    }
  };

  const emitAdministratorRemoved = (administratorHash: ActionHash): void => {
    try {
      storeEventBus.emit('administrator:removed', { administratorHash });
      userEventEmitters.emitDeleted(administratorHash);
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

/**
 * ADMINISTRATION STORE - DEMONSTRATING STANDARDIZED STORE HELPER PATTERNS
 *
 * This store demonstrates the use of the 9 standardized helper functions adapted for administration:
 *
 * 1. createUIEntityFromRecord - Entity creation from Holochain records (UIStatus creation)
 * 2. createGenericCacheSyncHelper - Cache-to-state synchronization for users/organizations
 * 3. createStatusAwareEventEmitters - Type-safe event emission with status support
 * 4. withLoadingState - Consistent loading/error state management
 * 5. createStatusTransitionHelper - Status workflow management (pending/accepted/rejected/suspended)
 * 6. createEntityCreationHelper - Standardized entity creation with validation
 * 7. processMultipleRecordCollections - Handling complex API responses with multiple collections
 * 8. createErrorHandler - Domain-specific error handling
 * 9. createEntityFetcher - Data fetching with loading state and error handling
 *
 * This administration store manages users, organizations, and their status transitions,
 * serving as a comprehensive example of status-aware entity management.
 *
 * @returns An Effect that creates an administration store with state and methods
 */
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
    // HELPER INITIALIZATION WITH STANDARDIZED UTILITIES
    // ========================================================================

    // 1. LOADING STATE MANAGEMENT - Using LoadingStateSetter interface
    const setters: LoadingStateSetter = {
      setLoading: (value) => {
        loading = value;
      },
      setError: (value) => {
        error = value;
      }
    };

    // 2. CACHE SYNCHRONIZATION - Using createGenericCacheSyncHelper for mixed entity types
    // Note: This is a complex case with mixed entity types (users and organizations)
    const createMixedEntityCacheSyncHelper = (
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
          // Handle UIUser
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
          // Handle UIOrganization
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

    const { syncCacheToState } = createMixedEntityCacheSyncHelper(
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
      setters.setError(null);
    };

    // ========================================================================
    // STORE METHODS
    // ========================================================================

    const initialize = (): E.Effect<void, AdministrationError, HolochainClientServiceTag> =>
      withLoadingState(() =>
        pipe(
          E.all([fetchAllUsers(), fetchAllOrganizations()]),
          E.flatMap(() =>
            E.all([fetchAllUsersStatusHistory(), fetchAllOrganizationsStatusHistory()])
          ),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.INITIALIZE))
          )
        )
      )(setters);

    const fetchAllUsers = (): E.Effect<UIUser[], AdministrationError> =>
      userEntityFetcher(
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
              E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.FETCH_USERS))
            )
          ),
        {
          targetArray: allUsers,
          errorContext: ERROR_CONTEXTS.FETCH_USERS,
          setters
        }
      );

    const fetchAllOrganizations = (): E.Effect<UIOrganization[], AdministrationError> =>
      organizationEntityFetcher(
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
              E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.FETCH_ORGANIZATIONS))
            )
          ),
        {
          targetArray: allOrganizations,
          errorContext: ERROR_CONTEXTS.FETCH_ORGANIZATIONS,
          setters
        }
      );

    const registerNetworkAdministrator = (
      entity_original_action_hash: ActionHash,
      agent_pubkeys: AgentPubKey[]
    ): E.Effect<boolean, AdministrationError> =>
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
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.REGISTER_ADMINISTRATOR))
          )
        )
      )(setters);

    const addNetworkAdministrator = (
      entity_original_action_hash: ActionHash,
      agent_pubkeys: AgentPubKey[]
    ): E.Effect<boolean, AdministrationError> =>
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
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.ADD_ADMINISTRATOR))
          )
        )
      )(setters);

    const removeNetworkAdministrator = (
      entity_original_action_hash: ActionHash,
      agent_pubkeys: AgentPubKey[]
    ): E.Effect<boolean, AdministrationError> =>
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
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.REMOVE_ADMINISTRATOR))
          )
        )
      )(setters);

    const checkIfAgentIsAdministrator = (): E.Effect<boolean, AdministrationError> =>
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
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.CHECK_ADMINISTRATOR))
          )
        )
      )(setters);

    const getAllNetworkAdministrators = (): E.Effect<UIUser[], AdministrationError> =>
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
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.GET_ADMINISTRATORS))
          )
        )
      )(setters);

    const createStatus = (status: StatusInDHT): E.Effect<HolochainRecord, AdministrationError> =>
      withLoadingState(() =>
        pipe(
          administrationService.createStatus(status),
          E.catchAll((error) =>
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.CREATE_STATUS))
          )
        )
      )(setters);

    const getLatestStatusForEntity = (
      entity_original_action_hash: ActionHash,
      entity_type: AdministrationEntity
    ): E.Effect<UIStatus | null, AdministrationError> =>
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
          E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.GET_STATUS))
        )
      );

    const updateUserStatus = (
      entity_original_action_hash: ActionHash,
      status_original_action_hash: ActionHash,
      status_previous_action_hash: ActionHash,
      new_status: StatusInDHT
    ): E.Effect<HolochainRecord, AdministrationError> =>
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
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.UPDATE_STATUS))
          )
        )
      )(setters);

    const updateOrganizationStatus = (
      entity_original_action_hash: ActionHash,
      status_original_action_hash: ActionHash,
      status_previous_action_hash: ActionHash,
      new_status: StatusInDHT
    ): E.Effect<HolochainRecord, AdministrationError> =>
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
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.UPDATE_STATUS))
          )
        )
      )(setters);

    const approveUser = (user: UIUser): E.Effect<HolochainRecord, AdministrationError> =>
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
            // Emit user:accepted event for hREA agent creation
            storeEventBus.emit('user:accepted', { user });
            invalidateCache();
            // Refresh status history after status change
            E.runFork(E.provide(fetchAllUsersStatusHistory(), HolochainClientLive));
          }),
          E.catchAll((error) =>
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.APPROVE_USER))
          )
        )
      )(setters);

    const rejectUser = (user: UIUser): E.Effect<HolochainRecord, AdministrationError> =>
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
            // Refresh status history after status change
            E.runFork(E.provide(fetchAllUsersStatusHistory(), HolochainClientLive));
          }),
          E.catchAll((error) =>
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.REJECT_USER))
          )
        )
      )(setters);

    const approveOrganization = (
      organization: UIOrganization
    ): E.Effect<HolochainRecord, AdministrationError> =>
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
            // Emit organization:accepted event for hREA agent creation
            storeEventBus.emit('organization:accepted', { organization });
            invalidateCache();
            // Refresh status history after status change
            E.runFork(E.provide(fetchAllOrganizationsStatusHistory(), HolochainClientLive));
          }),
          E.catchAll((error) =>
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.APPROVE_ORGANIZATION))
          )
        )
      )(setters);

    const rejectOrganization = (
      organization: UIOrganization
    ): E.Effect<HolochainRecord, AdministrationError> =>
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
            // Refresh status history after status change
            E.runFork(E.provide(fetchAllOrganizationsStatusHistory(), HolochainClientLive));
          }),
          E.catchAll((error) =>
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.REJECT_ORGANIZATION))
          )
        )
      )(setters);

    const fetchAllUsersStatusHistory = (): E.Effect<void, AdministrationError, never> =>
      withLoadingState(() =>
        pipe(
          E.succeed(allUsers),
          E.tap((users) =>
            E.sync(() =>
              console.log(
                `📋 TDD: Starting to fetch status history for ${users.length} users:`,
                users.map((u) => ({
                  name: u.name,
                  hash: u.original_action_hash?.toString().slice(0, 8)
                }))
              )
            )
          ),
          E.flatMap((users) => {
            const usersWithHashes = users.filter((user) => user.original_action_hash);
            console.log(`📋 TDD: Users with action hashes: ${usersWithHashes.length}`);

            return E.all(
              usersWithHashes.map((user, index) =>
                pipe(
                  getEntityStatusHistory(user),
                  E.tap((revisions) => {
                    console.log(
                      `📋 TDD: User ${index + 1}/${usersWithHashes.length} - ${user.name}: Got ${revisions.length} revisions`
                    );
                    revisions.forEach((rev, revIndex) => {
                      console.log(
                        `  📝 Revision ${revIndex + 1}: ${rev.status?.status_type} at ${new Date(rev.timestamp || 0).toISOString()}`
                      );
                    });
                  }),
                  E.catchAll((error) => {
                    console.error(
                      `❌ TDD: Failed to get status history for user ${user.name}:`,
                      error
                    );
                    return E.succeed([] as Revision[]);
                  })
                )
              )
            );
          }),
          E.map((allRevisions) => {
            const flatRevisions = allRevisions.flat();
            console.log(
              `📋 TDD: Total revisions collected across all users: ${flatRevisions.length}`
            );
            console.log(
              `📋 TDD: Revisions breakdown:`,
              flatRevisions.map((rev) => ({
                user: rev.entity?.name,
                status: rev.status?.status_type,
                timestamp: new Date(rev.timestamp || 0).toISOString()
              }))
            );
            return flatRevisions;
          }),
          E.tap((revisions) => {
            console.log(
              `📋 TDD: Setting allUsersStatusesHistory with ${revisions.length} revisions`
            );
            allUsersStatusesHistory.splice(0, allUsersStatusesHistory.length, ...revisions);
            console.log(
              `📋 TDD: allUsersStatusesHistory now contains ${allUsersStatusesHistory.length} items`
            );
          }),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(AdministrationError.fromError(error, 'Failed to fetch users status history'))
          )
        )
      )(setters);

    const fetchAllOrganizationsStatusHistory = (): E.Effect<void, AdministrationError, never> =>
      withLoadingState(() =>
        pipe(
          E.succeed(allOrganizations),
          E.flatMap((organizations) =>
            E.all(
              organizations
                .filter((organization) => organization.original_action_hash) // Only fetch for organizations with proper hashes
                .map((organization) =>
                  pipe(
                    getEntityStatusHistory(organization),
                    E.catchAll(() => E.succeed([] as Revision[]))
                  )
                )
            )
          ),
          E.map((allRevisions) => allRevisions.flat()),
          E.tap((revisions) => {
            allOrganizationsStatusesHistory.splice(
              0,
              allOrganizationsStatusesHistory.length,
              ...revisions
            );
          }),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(
              AdministrationError.fromError(error, 'Failed to fetch organizations status history')
            )
          )
        )
      )(setters);

    const suspendUser = (
      user: UIUser,
      reason?: string,
      suspended_until?: string
    ): E.Effect<HolochainRecord, AdministrationError> =>
      withLoadingState(() =>
        pipe(
          E.succeed(user),
          E.flatMap((u) => {
            if (!u.status?.original_action_hash) {
              return E.fail(new Error('User status information missing'));
            }
            const previousActionHash =
              u.status.previous_action_hash || u.status.original_action_hash;
            const statusType = suspended_until ? 'suspended temporarily' : 'suspended indefinitely';
            return updateUserStatus(
              u.original_action_hash!,
              u.status.original_action_hash,
              previousActionHash,
              {
                status_type: statusType,
                reason: reason || 'Suspended by administrator',
                suspended_until
              }
            );
          }),
          E.tap(() => {
            emitUserStatusUpdated(user);
            invalidateCache();
            // Refresh status history after status change
            E.runFork(E.provide(fetchAllUsersStatusHistory(), HolochainClientLive));
          }),
          E.catchAll((error) =>
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.SUSPEND_USER))
          )
        )
      )(setters);

    const unsuspendUser = (user: UIUser): E.Effect<HolochainRecord, AdministrationError> =>
      withLoadingState(() =>
        pipe(
          E.succeed(user),
          E.flatMap((u) => {
            if (!u.status?.original_action_hash) {
              return E.fail(new Error('User status information missing'));
            }
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
            // Refresh status history after status change
            E.runFork(E.provide(fetchAllUsersStatusHistory(), HolochainClientLive));
          }),
          E.catchAll((error) =>
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.UNSUSPEND_ENTITY))
          )
        )
      )(setters);

    const suspendOrganization = (
      organization: UIOrganization,
      reason?: string,
      suspended_until?: string
    ): E.Effect<HolochainRecord, AdministrationError> =>
      withLoadingState(() =>
        pipe(
          E.succeed(organization),
          E.flatMap((org) => {
            if (!org.status?.original_action_hash) {
              return E.fail(new Error('Organization status information missing'));
            }
            const previousActionHash =
              org.status.previous_action_hash || org.status.original_action_hash;
            const statusType = suspended_until ? 'suspended temporarily' : 'suspended indefinitely';
            return updateOrganizationStatus(
              org.original_action_hash!,
              org.status.original_action_hash,
              previousActionHash,
              {
                status_type: statusType,
                reason: reason || 'Suspended by administrator',
                suspended_until
              }
            );
          }),
          E.tap(() => {
            emitOrganizationStatusUpdated(organization);
            invalidateCache();
            // Refresh status history after status change
            E.runFork(E.provide(fetchAllOrganizationsStatusHistory(), HolochainClientLive));
          }),
          E.catchAll((error) =>
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.SUSPEND_ORGANIZATION))
          )
        )
      )(setters);

    const unsuspendOrganization = (
      organization: UIOrganization
    ): E.Effect<HolochainRecord, AdministrationError> =>
      withLoadingState(() =>
        pipe(
          E.succeed(organization),
          E.flatMap((org) => {
            if (!org.status?.original_action_hash) {
              return E.fail(new Error('Organization status information missing'));
            }
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
            // Refresh status history after status change
            E.runFork(E.provide(fetchAllOrganizationsStatusHistory(), HolochainClientLive));
          }),
          E.catchAll((error) =>
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.UNSUSPEND_ENTITY))
          )
        )
      )(setters);

    const refreshAll = (): E.Effect<void, AdministrationError, HolochainClientServiceTag> =>
      withLoadingState(() =>
        pipe(
          E.all([
            fetchAllUsers(),
            fetchAllOrganizations(),
            getAllNetworkAdministrators(),
            fetchAllUsersStatusHistory(),
            fetchAllOrganizationsStatusHistory()
          ]),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(AdministrationError.fromError(error, ERROR_CONTEXTS.REFRESH))
          )
        )
      )(setters);

    const getAllRevisionsForStatus = (
      entity: UIUser | UIOrganization
    ): E.Effect<UIStatus[], AdministrationError> =>
      pipe(
        E.succeed(entity),
        E.filterOrFail(
          (entity): entity is typeof entity & { original_action_hash: ActionHash } =>
            !!entity.original_action_hash,
          () =>
            AdministrationError.fromError(
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
            AdministrationError.fromError(
              new Error('Status record not found'),
              ERROR_CONTEXTS.GET_ALL_REVISIONS_FOR_STATUS
            )
        ),
        E.flatMap((status) =>
          administrationService.getAllRevisionsForStatus(status.original_action_hash)
        ),
        E.map((records) =>
          records
            .map(createUIStatusFromRecord)
            .filter((status): status is UIStatus => status !== null)
        ),
        E.mapError((e) =>
          AdministrationError.fromError(e, ERROR_CONTEXTS.GET_ALL_REVISIONS_FOR_STATUS)
        )
      );

    const getEntityStatusHistory = (
      entity: UIUser | UIOrganization
    ): E.Effect<Revision[], AdministrationError, never> =>
      pipe(
        E.gen(function* () {
          const holochainClient = yield* HolochainClientServiceTag;
          return yield* pipe(
            E.succeed(entity),
            E.tap((entity) => {
              console.log(
                `🔍 Getting status history for entity: ${entity.name} (${entity.original_action_hash?.toString().slice(0, 8)})`
              );
            }),
            E.filterOrFail(
              (entity): entity is typeof entity & { original_action_hash: ActionHash } =>
                !!entity.original_action_hash,
              () =>
                AdministrationError.fromError(
                  new Error('Entity has no original_action_hash'),
                  ERROR_CONTEXTS.GET_ALL_REVISIONS_FOR_STATUS
                )
            ),
            E.flatMap((entity) => {
              const entityType = getEntityType(entity);

              return pipe(
                // Get the latest status record for this entity
                administrationService.getLatestStatusRecordForEntity({
                  entity: entityType,
                  entity_original_action_hash: entity.original_action_hash
                }),
                E.tap((latestStatusRecord) => {
                  console.log(
                    `🔍 Latest status record for ${entity.name}:`,
                    latestStatusRecord ? 'Found' : 'Not found'
                  );
                }),
                E.filterOrFail(
                  (record): record is HolochainRecord => !!record,
                  () =>
                    AdministrationError.fromError(
                      new Error('No status record found for entity'),
                      ERROR_CONTEXTS.GET_ALL_REVISIONS_FOR_STATUS
                    )
                ),
                E.flatMap((latestStatusRecord) => {
                  // Find the original status action hash
                  const findOriginalStatusHash = (record: HolochainRecord): ActionHash => {
                    const action = record.signed_action.hashed.content;
                    if (action.type === 'Update') {
                      return action.original_action_address;
                    } else {
                      return record.signed_action.hashed.hash;
                    }
                  };

                  const originalStatusHash = findOriginalStatusHash(latestStatusRecord);
                  console.log(
                    `🔍 Original status hash for ${entity.name}: ${originalStatusHash.toString().slice(0, 8)}`
                  );

                  return pipe(
                    // Get all revisions from backend (may be incomplete due to backend limitation)
                    administrationService.getAllRevisionsForStatus(originalStatusHash),
                    E.tap((backendRecords) => {
                      console.log(
                        `🔍 Backend returned ${backendRecords.length} revision records for ${entity.name}`
                      );
                    }),
                    E.flatMap((backendRecords) => {
                      // Check if we have the original Create record
                      const hasCreateRecord = backendRecords.some((record) => {
                        const action = record.signed_action.hashed.content;
                        return action.type === 'Create';
                      });

                      if (hasCreateRecord) {
                        console.log(
                          `✅ Complete history found for ${entity.name}, no need to fetch missing records`
                        );
                        return E.succeed(backendRecords);
                      }

                      // Backend limitation: missing original Create record, fetch it separately
                      console.log(
                        `⚠️ Missing original Create record for ${entity.name}, fetching separately...`
                      );

                      return pipe(
                        // Get the original Create record using the original status hash
                        holochainClient.callZomeRawEffect(
                          'administration',
                          'get_record',
                          originalStatusHash
                        ),
                        E.map((originalRecord) => {
                          if (originalRecord) {
                            console.log(`✅ Found missing Create record for ${entity.name}`);
                            // Combine original record with backend records
                            return [originalRecord as HolochainRecord, ...backendRecords];
                          } else {
                            console.warn(
                              `⚠️ Could not fetch original Create record for ${entity.name}`
                            );
                            return backendRecords;
                          }
                        }),
                        E.catchAll((error) => {
                          console.error(
                            `❌ Error fetching original record for ${entity.name}:`,
                            error
                          );
                          // Return backend records even if we can't fetch the original
                          return E.succeed(backendRecords);
                        })
                      );
                    }),
                    E.map((allRecords) => {
                      // Sort records chronologically
                      const sortedRecords = allRecords.sort(
                        (a, b) =>
                          a.signed_action.hashed.content.timestamp -
                          b.signed_action.hashed.content.timestamp
                      );

                      console.log(
                        `🔍 Processing ${sortedRecords.length} total records for ${entity.name} (including any fetched missing records)`
                      );

                      // Convert records to revisions
                      const revisions = sortedRecords
                        .map((record: HolochainRecord, index) => {
                          const uiStatus = createUIStatusFromRecord(record);
                          const timestamp = record.signed_action.hashed.content.timestamp;

                          if (!uiStatus) {
                            console.warn(
                              `⚠️ Failed to parse status for ${entity.name}, record ${index + 1}`
                            );
                            return null;
                          }

                          console.log(
                            `✅ Parsed revision ${index + 1} for ${entity.name}: ${uiStatus.status_type} at ${new Date(timestamp).toISOString()}`
                          );

                          return {
                            status: uiStatus,
                            timestamp,
                            entity
                          } as Revision;
                        })
                        .filter((revision): revision is Revision => revision !== null);

                      console.log(
                        `🎯 Final result for ${entity.name}: ${revisions.length} revisions`
                      );
                      revisions.forEach((rev, index) => {
                        console.log(
                          `   ${index + 1}. ${rev.status?.status_type} - ${rev.status?.reason || 'No reason'} (${new Date(rev.timestamp || 0).toLocaleString()})`
                        );
                      });

                      return revisions;
                    })
                  );
                })
              );
            }),
            E.mapError((e) =>
              AdministrationError.fromError(e, ERROR_CONTEXTS.GET_ALL_REVISIONS_FOR_STATUS)
            )
          );
        }),
        E.provideService(HolochainClientServiceTag, holochainClientService)
      );

    // ========================================================================
    // UTILITY FUNCTIONS FOR STATUS VALIDATION
    // ========================================================================

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
      fetchAllUsersStatusHistory,
      fetchAllOrganizationsStatusHistory,
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
      suspendUser,
      unsuspendUser,
      approveOrganization,
      rejectOrganization,
      suspendOrganization,
      unsuspendOrganization,
      refreshAll,
      invalidateCache,
      getAllRevisionsForStatus,
      getEntityStatusHistory
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
