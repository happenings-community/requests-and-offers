import type { ActionHash, AgentPubKey, Link, Record } from '@holochain/client';
import {
  OrganizationsServiceTag,
  OrganizationsServiceLive,
  type OrganizationsService
} from '$lib/services/zomes/organizations.service';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { createAppRuntime } from '$lib/runtime/app-runtime';
import { OrganizationError, ORGANIZATION_CONTEXTS } from '$lib/errors';
import { CacheNotFoundError } from '$lib/errors';
import { Effect as E, pipe } from 'effect';
import type { UIOrganization, UIStatus } from '$lib/types/ui';
import type {
  OrganizationInDHT,
  CreateOrganizationInput
} from '$lib/schemas/organizations.schemas';
import { AdministrationEntity } from '$lib/types/holochain';
import administrationStore from '$lib/stores/administration.store.svelte';
import { CACHE_EXPIRY } from '$lib/utils/constants';

// Import standardized store helpers
import {
  withLoadingState,
  createErrorHandler,
  createGenericCacheSyncHelper,
  createEntityFetcher,
  createStatusAwareEventEmitters,
  createUIEntityFromRecord,
  createEntityCreationHelper,
  type LoadingStateSetter
} from '$lib/utils/store-helpers';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_EXPIRY_MS = CACHE_EXPIRY.ORGANIZATIONS;

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Standardized error handler for Organization operations
 */
const handleOrganizationError = createErrorHandler(
  OrganizationError.fromError,
  'Organization operation failed'
);

/**
 * Create standardized event emitters for Organization entities with status support
 */
const organizationEventEmitters = createStatusAwareEventEmitters<UIOrganization>('organization');

/**
 * Create standardized entity fetcher for Organizations
 */
const organizationEntityFetcher = createEntityFetcher<UIOrganization, OrganizationError>(
  handleOrganizationError
);

/**
 * Cache lookup function for organizations
 */
const organizationCacheLookup = (
  key: string
): E.Effect<UIOrganization, CacheNotFoundError, never> => {
  return E.fail(new CacheNotFoundError({ key }));
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type HolochainEntry = {
  Present: {
    entry: Uint8Array;
  };
};

export type OrganizationsStore = {
  readonly acceptedOrganizations: UIOrganization[];
  readonly currentOrganization: UIOrganization | null;
  readonly currentMembers: ActionHash[];
  readonly currentCoordinators: ActionHash[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCacheService<UIOrganization>;

  createOrganization: (organization: OrganizationInDHT) => E.Effect<Record, OrganizationError>;
  getLatestOrganization: (
    original_action_hash: ActionHash
  ) => E.Effect<UIOrganization | null, OrganizationError>;
  getOrganizationByActionHash: (
    actionHash: ActionHash
  ) => E.Effect<UIOrganization | null, OrganizationError>;
  setCurrentOrganization: (organization: UIOrganization) => E.Effect<void, OrganizationError>;
  getAcceptedOrganizations: () => E.Effect<UIOrganization[], OrganizationError>;
  addMember: (
    organization_original_action_hash: ActionHash,
    memberActionHash: ActionHash
  ) => E.Effect<boolean, OrganizationError>;
  removeMember: (
    organization_original_action_hash: ActionHash,
    memberActionHash: ActionHash
  ) => E.Effect<boolean, OrganizationError>;
  addCoordinator: (
    organization_original_action_hash: ActionHash,
    coordinatorActionHash: ActionHash
  ) => E.Effect<boolean, OrganizationError>;
  removeCoordinator: (
    organization_original_action_hash: ActionHash,
    coordinatorActionHash: ActionHash
  ) => E.Effect<boolean, OrganizationError>;
  updateOrganization: (
    hash: ActionHash,
    updates: Partial<OrganizationInDHT>
  ) => E.Effect<UIOrganization | null, OrganizationError>;
  deleteOrganization: (
    organization_original_action_hash: ActionHash
  ) => E.Effect<boolean, OrganizationError>;
  leaveOrganization: (hash: ActionHash) => E.Effect<boolean, OrganizationError>;
  isOrganizationCoordinator: (
    orgHash: ActionHash,
    userHash: ActionHash
  ) => E.Effect<boolean, OrganizationError>;
  getUserOrganizations: (userHash: ActionHash) => E.Effect<UIOrganization[], OrganizationError>;
  invalidateCache: () => void;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a complete UIOrganization from a record using standardized helper pattern
 * This demonstrates the use of createUIEntityFromRecord from store-helpers
 */
const createUIOrganization = createUIEntityFromRecord<OrganizationInDHT, UIOrganization>(
  (entry, actionHash, timestamp, additionalData) => {
    const members = (additionalData?.members as ActionHash[]) || [];
    const coordinators = (additionalData?.coordinators as ActionHash[]) || [];
    const status = additionalData?.status as UIStatus;

    return {
      ...entry,
      urls: Array.from(entry.urls || []),
      original_action_hash: actionHash,
      previous_action_hash: actionHash,
      members,
      coordinators,
      status,
      created_at: timestamp,
      updated_at: timestamp
    };
  }
);

/**
 * Creates enhanced UIOrganization from record with additional processing
 * This handles members, coordinators, and status relationships
 */
const createEnhancedUIOrganization = (
  record: Record,
  organizationsService: OrganizationsService,
  originalActionHash: ActionHash
): E.Effect<UIOrganization | null, OrganizationError> => {
  return pipe(
    E.all({
      members: organizationsService.getOrganizationMembersLinks(originalActionHash),
      coordinators: organizationsService.getOrganizationCoordinatorsLinks(originalActionHash)
    }),
    E.flatMap(({ members, coordinators }) => {
      return pipe(
        administrationStore.getLatestStatusForEntity(
          originalActionHash,
          AdministrationEntity.Organizations
        ),
        E.map((status) => {
          const additionalData = {
            members: members.map((link) => link.target),
            coordinators: coordinators.map((link) => link.target),
            status: status || undefined
          };

          const entity = createUIOrganization(record, additionalData);
          return entity;
        }),
        E.catchAll(() => {
          // If status fetch fails, create organization without status
          const additionalData = {
            members: members.map((link) => link.target),
            coordinators: coordinators.map((link) => link.target)
          };

          const entity = createUIOrganization(record, additionalData);
          return E.succeed(entity);
        })
      );
    }),
    E.mapError((error) =>
      OrganizationError.fromError(error, ORGANIZATION_CONTEXTS.DECODE_ORGANIZATIONS)
    )
  );
};

/**
 * ORGANIZATIONS STORE - USING STANDARDIZED STORE HELPER PATTERNS
 *
 * This store demonstrates the integration of standardized helper functions following the Service Types template:
 *
 * 1. createUIEntityFromRecord - Entity creation from Holochain records
 * 2. createGenericCacheSyncHelper - Cache-to-state synchronization
 * 3. createStatusAwareEventEmitters - Type-safe event emission with status support
 * 4. withLoadingState - Consistent loading/error state management
 * 5. createEntityCreationHelper - Standardized entity creation with validation
 * 6. createErrorHandler - Domain-specific error handling
 * 7. createEntityFetcher - Data fetching with loading state and error handling
 * 8. createCacheLookupFunction - Cache miss handling with service fallback
 *
 * This implementation focuses on consistent patterns for CRUD operations with
 * proper error handling, caching, and event emission.
 *
 * @returns An Effect that creates an organizations store with state and methods
 */

// ============================================================================
// STORE FACTORY FUNCTION
// ============================================================================

import { AppServicesTag } from '$lib/runtime/app-runtime';

export const createOrganizationsStore = (): E.Effect<
  OrganizationsStore,
  never,
  AppServicesTag | CacheServiceTag
> =>
  E.gen(function* () {
    const { organizations: organizationsService } = yield* AppServicesTag;
    const cacheService = yield* CacheServiceTag;

    // ========================================================================
    // STATE INITIALIZATION
    // ========================================================================
    let currentOrganization = $state<UIOrganization | null>(null);
    const acceptedOrganizations: UIOrganization[] = $state([]);
    let loading: boolean = $state(false);
    let error: string | null = $state(null);

    const currentMembers: ActionHash[] = $derived(currentOrganization?.members || []);
    const currentCoordinators: ActionHash[] = $derived(currentOrganization?.coordinators || []);

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
      all: acceptedOrganizations
    });

    // 3. EVENT EMITTERS - Using createStatusAwareEventEmitters
    const eventEmitters = organizationEventEmitters;

    // 4. CACHE MANAGEMENT - Using standardized cache lookup pattern
    const cache = yield* cacheService.createEntityCache<UIOrganization>(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      organizationCacheLookup
    );

    // 5. ENTITY CREATION - Using createEntityCreationHelper
    const { createEntity } = createEntityCreationHelper(createUIOrganization);

    // ===== STATE MANAGEMENT FUNCTIONS =====

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
      acceptedOrganizations.length = 0;
      currentOrganization = null;
      setters.setError(null);
    };

    // ========================================================================
    // STORE METHODS
    // ========================================================================

    const createOrganization = (
      organization: OrganizationInDHT
    ): E.Effect<Record, OrganizationError> =>
      withLoadingState(() =>
        pipe(
          organizationsService.createOrganization(organization),
          E.tap((record) => {
            const entity = createUIOrganization(record, {});
            if (entity) {
              E.runSync(cache.set(record.signed_action.hashed.hash.toString(), entity));
              syncCacheToState(entity, 'add');
              eventEmitters.emitCreated(entity);
            }
          }),
          E.catchAll((error) =>
            E.fail(OrganizationError.fromError(error, ORGANIZATION_CONTEXTS.CREATE_ORGANIZATION))
          )
        )
      )(setters);

    const getLatestOrganization = (
      original_action_hash: ActionHash
    ): E.Effect<UIOrganization | null, OrganizationError> =>
      withLoadingState(() =>
        pipe(
          organizationsService.getLatestOrganizationRecord(original_action_hash),
          E.flatMap((record) => {
            if (!record) return E.succeed(null);

            return pipe(
              createEnhancedUIOrganization(record, organizationsService, original_action_hash),
              E.tap((organization) => {
                if (organization) {
                  E.runSync(cache.set(original_action_hash.toString(), organization));
                  syncCacheToState(organization, 'add');
                  eventEmitters.emitCreated(organization);
                }
              })
            );
          }),
          E.catchAll((error) =>
            E.fail(
              OrganizationError.fromError(error, ORGANIZATION_CONTEXTS.GET_LATEST_ORGANIZATION)
            )
          )
        )
      )(setters);

    const getOrganizationByActionHash = (
      actionHash: ActionHash
    ): E.Effect<UIOrganization | null, OrganizationError> =>
      withLoadingState(() =>
        pipe(
          cache.get(actionHash.toString()),
          E.catchAll(() => getLatestOrganization(actionHash)),
          E.tap((organization) => {
            if (organization) {
              eventEmitters.emitCreated(organization);
            }
          }),
          E.catchAll((error) =>
            E.fail(
              OrganizationError.fromError(
                error,
                ORGANIZATION_CONTEXTS.GET_ORGANIZATION,
                actionHash.toString()
              )
            )
          )
        )
      )(setters);

    const setCurrentOrganization = (
      organization: UIOrganization
    ): E.Effect<void, OrganizationError> =>
      pipe(
        E.sync(() => {
          currentOrganization = organization;
        }),
        E.catchAll((error) =>
          E.fail(
            OrganizationError.fromError(
              error,
              ORGANIZATION_CONTEXTS.GET_ORGANIZATION,
              organization.original_action_hash?.toString()
            )
          )
        )
      );

    const getAcceptedOrganizations = (): E.Effect<UIOrganization[], OrganizationError> =>
      organizationEntityFetcher(
        () =>
          pipe(
            organizationsService.getAcceptedOrganizationsLinks(),
            E.flatMap((links) =>
              E.all(
                links.map((link) =>
                  pipe(
                    getLatestOrganization(link.target),
                    E.flatMap((organization) => {
                      if (!organization) return E.succeed(null);
                      return pipe(
                        administrationStore.getLatestStatusForEntity(
                          link.target,
                          AdministrationEntity.Organizations
                        ),
                        E.map(
                          (status) =>
                            ({ ...organization, status: status || undefined }) as UIOrganization
                        )
                      );
                    })
                  )
                )
              )
            ),
            E.map((organizations) => {
              const validOrganizations = organizations.filter(
                (organization): organization is UIOrganization => organization !== null
              );
              validOrganizations.forEach((organization) => {
                const organizationHash = organization.original_action_hash;
                if (organizationHash) {
                  E.runSync(cache.set(organizationHash.toString(), organization));
                  syncCacheToState(organization, 'add');
                }
              });
              return validOrganizations;
            }),
            E.catchAll((error) => {
              const errorMessage = String(error);
              if (errorMessage.includes('Client not connected')) {
                console.warn('Holochain client not connected, returning empty organizations array');
                return E.succeed([]);
              }
              return E.fail(
                OrganizationError.fromError(error, ORGANIZATION_CONTEXTS.GET_ACCEPTED_ORGANIZATIONS)
              );
            })
          ),
        {
          targetArray: acceptedOrganizations,
          errorContext: ORGANIZATION_CONTEXTS.GET_ACCEPTED_ORGANIZATIONS,
          setters
        }
      );

    const memberAction = (
      action: 'add' | 'remove',
      organization_original_action_hash: ActionHash,
      memberActionHash: ActionHash
    ): E.Effect<boolean, OrganizationError> => {
      const serviceCall =
        action === 'add'
          ? organizationsService.addOrganizationMember
          : organizationsService.removeOrganizationMember;
      const errorContext =
        action === 'add'
          ? ORGANIZATION_CONTEXTS.ADD_ORGANIZATION_MEMBER
          : ORGANIZATION_CONTEXTS.REMOVE_ORGANIZATION_MEMBER;

      return withLoadingState(() =>
        pipe(
          serviceCall(organization_original_action_hash, memberActionHash),
          E.tap(() => E.runSync(cache.invalidate(organization_original_action_hash.toString()))),
          E.catchAll((error) => E.fail(OrganizationError.fromError(error, errorContext)))
        )
      )(setters);
    };

    const addMember = (
      organization_original_action_hash: ActionHash,
      memberActionHash: ActionHash
    ) => memberAction('add', organization_original_action_hash, memberActionHash);

    const removeMember = (
      organization_original_action_hash: ActionHash,
      memberActionHash: ActionHash
    ) => memberAction('remove', organization_original_action_hash, memberActionHash);

    const coordinatorAction = (
      action: 'add' | 'remove',
      organization_original_action_hash: ActionHash,
      coordinatorActionHash: ActionHash
    ): E.Effect<boolean, OrganizationError> => {
      const serviceCall =
        action === 'add'
          ? organizationsService.addOrganizationCoordinator
          : organizationsService.removeOrganizationCoordinator;
      const errorContext =
        action === 'add'
          ? ORGANIZATION_CONTEXTS.ADD_ORGANIZATION_COORDINATOR
          : ORGANIZATION_CONTEXTS.REMOVE_ORGANIZATION_COORDINATOR;

      return withLoadingState(() =>
        pipe(
          serviceCall(organization_original_action_hash, coordinatorActionHash),
          E.tap(() => E.runSync(cache.invalidate(organization_original_action_hash.toString()))),
          E.catchAll((error) => E.fail(OrganizationError.fromError(error, errorContext)))
        )
      )(setters);
    };

    const addCoordinator = (
      organization_original_action_hash: ActionHash,
      coordinatorActionHash: ActionHash
    ) => coordinatorAction('add', organization_original_action_hash, coordinatorActionHash);

    const removeCoordinator = (
      organization_original_action_hash: ActionHash,
      coordinatorActionHash: ActionHash
    ) => coordinatorAction('remove', organization_original_action_hash, coordinatorActionHash);

    const updateOrganization = (
      hash: ActionHash,
      updates: Partial<OrganizationInDHT>
    ): E.Effect<UIOrganization | null, OrganizationError> =>
      withLoadingState(() =>
        pipe(
          getOrganizationByActionHash(hash),
          E.flatMap((org) => {
            if (!org || !org.original_action_hash || !org.previous_action_hash)
              return E.succeed(null);
            const updatedOrg = { ...org, ...updates };
            return pipe(
              organizationsService.updateOrganization({
                original_action_hash: org.original_action_hash,
                previous_action_hash: org.previous_action_hash,
                updated_organization: updatedOrg
              }),
              E.flatMap(() => getLatestOrganization(hash)),
              E.tap((refreshedOrg) => {
                if (refreshedOrg) {
                  syncCacheToState(refreshedOrg, 'update');
                  eventEmitters.emitUpdated(refreshedOrg);
                }
              })
            );
          }),
          E.catchAll((error) =>
            E.fail(
              OrganizationError.fromError(
                error,
                ORGANIZATION_CONTEXTS.UPDATE_ORGANIZATION,
                hash.toString()
              )
            )
          )
        )
      )(setters);

    const deleteOrganization = (
      organization_original_action_hash: ActionHash
    ): E.Effect<boolean, OrganizationError> =>
      withLoadingState(() =>
        pipe(
          organizationsService.deleteOrganization(organization_original_action_hash),
          E.tap(() => {
            E.runSync(cache.invalidate(organization_original_action_hash.toString()));
            const dummyOrganization = {
              original_action_hash: organization_original_action_hash
            } as UIOrganization;
            syncCacheToState(dummyOrganization, 'remove');
            eventEmitters.emitDeleted(organization_original_action_hash);
          }),
          E.catchAll((error) =>
            E.fail(
              OrganizationError.fromError(
                error,
                ORGANIZATION_CONTEXTS.DELETE_ORGANIZATION,
                organization_original_action_hash.toString()
              )
            )
          )
        )
      )(setters);

    const leaveOrganization = (hash: ActionHash): E.Effect<boolean, OrganizationError> =>
      withLoadingState(() =>
        pipe(
          organizationsService.leaveOrganization(hash),
          E.tap(() => {
            E.runSync(cache.invalidate(hash.toString()));
            const dummyOrganization = { original_action_hash: hash } as UIOrganization;
            syncCacheToState(dummyOrganization, 'remove');
            // Could emit a custom leave event if needed
          }),
          E.catchAll((error) =>
            E.fail(
              OrganizationError.fromError(
                error,
                ORGANIZATION_CONTEXTS.REMOVE_ORGANIZATION_MEMBER,
                hash.toString()
              )
            )
          )
        )
      )(setters);

    const isOrganizationCoordinator = (
      orgHash: ActionHash,
      userHash: ActionHash
    ): E.Effect<boolean, OrganizationError> =>
      pipe(
        organizationsService.isOrganizationCoordinator(orgHash, userHash),
        E.catchAll((error) =>
          E.fail(
            OrganizationError.fromError(
              error,
              ORGANIZATION_CONTEXTS.CHECK_USER_IS_COORDINATOR,
              `${orgHash.toString()}-${userHash.toString()}`
            )
          )
        )
      );

    const getUserOrganizations = (
      userHash: ActionHash
    ): E.Effect<UIOrganization[], OrganizationError> =>
      organizationEntityFetcher(
        () =>
          pipe(
            organizationsService.getUserOrganizationsLinks(userHash),
            E.flatMap((links) => E.all(links.map((link) => getLatestOrganization(link.target)))),
            E.map((organizations) => {
              const validOrganizations = organizations.filter(
                (organization): organization is UIOrganization => organization !== null
              );
              validOrganizations.forEach((organization) => {
                const organizationHash = organization.original_action_hash;
                if (organizationHash) {
                  E.runSync(cache.set(organizationHash.toString(), organization));
                  syncCacheToState(organization, 'add');
                }
              });
              return validOrganizations;
            }),
            E.catchAll((error) =>
              E.fail(
                OrganizationError.fromError(error, ORGANIZATION_CONTEXTS.GET_USER_ORGANIZATIONS)
              )
            )
          ),
        {
          targetArray: acceptedOrganizations, // Note: This could be a separate searchResults array if needed
          errorContext: ORGANIZATION_CONTEXTS.GET_USER_ORGANIZATIONS,
          setters
        }
      );

    return {
      get acceptedOrganizations() {
        return acceptedOrganizations;
      },
      get currentOrganization() {
        return currentOrganization;
      },
      get currentMembers() {
        return currentMembers;
      },
      get currentCoordinators() {
        return currentCoordinators;
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

      createOrganization,
      getLatestOrganization,
      getOrganizationByActionHash,
      setCurrentOrganization,
      getAcceptedOrganizations,
      addMember,
      removeMember,
      addCoordinator,
      removeCoordinator,
      updateOrganization,
      deleteOrganization,
      leaveOrganization,
      isOrganizationCoordinator,
      getUserOrganizations,
      invalidateCache
    };
  });

// ============================================================================
// STORE INSTANCE CREATION
// ============================================================================

const organizationsStore: OrganizationsStore = pipe(
  createOrganizationsStore(),
  E.provide(createAppRuntime()),
  E.provide(CacheServiceLive),
  E.runSync
);

export default organizationsStore;
