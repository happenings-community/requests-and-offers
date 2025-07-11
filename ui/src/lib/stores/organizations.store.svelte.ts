import type { ActionHash, AgentPubKey, Link, Record } from '@holochain/client';
import { decode } from '@msgpack/msgpack';
import {
  OrganizationsServiceTag,
  OrganizationsServiceLive
} from '$lib/services/zomes/organizations.service';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { HolochainClientLive } from '$lib/services/holochainClient.service';
import { OrganizationStoreError } from '$lib/errors/organizations.errors';
import { CacheNotFoundError } from '$lib/errors';
import { storeEventBus } from '$lib/stores/storeEvents';
import { Effect as E, pipe } from 'effect';
import type { UIOrganization, UIStatus } from '$lib/types/ui';
import type {
  OrganizationInDHT,
  CreateOrganizationInput
} from '$lib/schemas/organizations.schemas';
import { AdministrationEntity } from '$lib/types/holochain';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const ERROR_CONTEXTS = {
  CREATE_ORGANIZATION: 'Failed to create organization',
  GET_LATEST_ORGANIZATION: 'Failed to get latest organization',
  GET_ORGANIZATION_BY_HASH: 'Failed to get organization by action hash',
  REFRESH_ORGANIZATION: 'Failed to refresh organization',
  SET_CURRENT_ORGANIZATION: 'Failed to set current organization',
  GET_ACCEPTED_ORGANIZATIONS: 'Failed to get accepted organizations',
  ADD_MEMBER: 'Failed to add member to organization',
  REMOVE_MEMBER: 'Failed to remove member from organization',
  ADD_COORDINATOR: 'Failed to add coordinator to organization',
  REMOVE_COORDINATOR: 'Failed to remove coordinator from organization',
  GET_USER_ORGANIZATIONS: 'Failed to get user organizations',
  UPDATE_ORGANIZATION: 'Failed to update organization',
  DELETE_ORGANIZATION: 'Failed to delete organization',
  LEAVE_ORGANIZATION: 'Failed to leave organization',
  CACHE_OPERATION: 'Cache operation failed'
} as const;

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

  createOrganization: (organization: OrganizationInDHT) => E.Effect<Record, OrganizationStoreError>;
  getLatestOrganization: (
    original_action_hash: ActionHash
  ) => E.Effect<UIOrganization | null, OrganizationStoreError>;
  getOrganizationByActionHash: (
    actionHash: ActionHash
  ) => E.Effect<UIOrganization | null, OrganizationStoreError>;
  setCurrentOrganization: (organization: UIOrganization) => E.Effect<void, OrganizationStoreError>;
  getAcceptedOrganizations: () => E.Effect<UIOrganization[], OrganizationStoreError>;
  addMember: (
    organization_original_action_hash: ActionHash,
    memberActionHash: ActionHash
  ) => E.Effect<boolean, OrganizationStoreError>;
  removeMember: (
    organization_original_action_hash: ActionHash,
    memberActionHash: ActionHash
  ) => E.Effect<boolean, OrganizationStoreError>;
  addCoordinator: (
    organization_original_action_hash: ActionHash,
    coordinatorActionHash: ActionHash
  ) => E.Effect<boolean, OrganizationStoreError>;
  removeCoordinator: (
    organization_original_action_hash: ActionHash,
    coordinatorActionHash: ActionHash
  ) => E.Effect<boolean, OrganizationStoreError>;
  updateOrganization: (
    hash: ActionHash,
    updates: Partial<OrganizationInDHT>
  ) => E.Effect<UIOrganization | null, OrganizationStoreError>;
  deleteOrganization: (
    organization_original_action_hash: ActionHash
  ) => E.Effect<boolean, OrganizationStoreError>;
  leaveOrganization: (hash: ActionHash) => E.Effect<boolean, OrganizationStoreError>;
  isOrganizationCoordinator: (
    orgHash: ActionHash,
    userHash: ActionHash
  ) => E.Effect<boolean, OrganizationStoreError>;
  getUserOrganizations: (
    userHash: ActionHash
  ) => E.Effect<UIOrganization[], OrganizationStoreError>;
  invalidateCache: () => void;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a UI organization from a record
 */
const createUIOrganizationFromRecord = (
  record: Record,
  members: ActionHash[] = [],
  coordinators: ActionHash[] = [],
  status?: UIStatus
): UIOrganization => {
  const decodedEntry = decode((record.entry as HolochainEntry).Present.entry) as OrganizationInDHT;

  return {
    ...decodedEntry,
    urls: Array.from(decodedEntry.urls || []),
    original_action_hash: record.signed_action.hashed.hash,
    previous_action_hash: record.signed_action.hashed.hash,
    members,
    coordinators,
    status
  };
};

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
// STORE FACTORY FUNCTION
// ============================================================================

export const createOrganizationsStore = (): E.Effect<
  OrganizationsStore,
  never,
  OrganizationsServiceTag | CacheServiceTag
> =>
  E.gen(function* () {
    const organizationsService = yield* OrganizationsServiceTag;
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

    const setLoading = (value: boolean) => {
      loading = value;
    };
    const setError = (value: string | null) => {
      error = value;
    };

    const lookupOrganization = (key: string): E.Effect<UIOrganization, CacheNotFoundError> =>
      pipe(
        E.tryPromise({
          try: async () => {
            const hash = new Uint8Array(Buffer.from(key, 'base64'));
            const record = await E.runPromise(
              organizationsService.getLatestOrganizationRecord(hash)
            );
            if (!record) {
              throw new CacheNotFoundError({ key });
            }
            return createUIOrganizationFromRecord(record);
          },
          catch: (e) => {
            if (e instanceof CacheNotFoundError) return e;
            return new CacheNotFoundError({ key });
          }
        })
      );

    const cache = yield* cacheService.createEntityCache<UIOrganization>(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      lookupOrganization
    );

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
      acceptedOrganizations.length = 0;
      currentOrganization = null;
      setError(null);
    };

    // ========================================================================
    // STORE METHODS
    // ========================================================================

    const createOrganization = (
      organization: OrganizationInDHT
    ): E.Effect<Record, OrganizationStoreError> =>
      withLoadingState(() =>
        pipe(
          organizationsService.createOrganization(organization),
          E.tap((record) => {
            const newOrganization = createUIOrganizationFromRecord(record);
            if (newOrganization.original_action_hash) {
              E.runSync(
                cache.set(newOrganization.original_action_hash.toString(), newOrganization)
              );
            }
            storeEventBus.emit('organization:created', { organization: newOrganization });
          }),
          E.mapError((e) => OrganizationStoreError.createOrganization(e))
        )
      )(setLoading, setError);

    const getLatestOrganization = (
      original_action_hash: ActionHash
    ): E.Effect<UIOrganization | null, OrganizationStoreError> =>
      withLoadingState(() =>
        pipe(
          organizationsService.getLatestOrganizationRecord(original_action_hash),
          E.flatMap((record) => {
            if (!record) return E.succeed(null);

            return pipe(
              E.all({
                members: organizationsService.getOrganizationMembersLinks(original_action_hash),
                coordinators:
                  organizationsService.getOrganizationCoordinatorsLinks(original_action_hash),
                statusLink: organizationsService.getOrganizationStatusLink(original_action_hash)
              }),
              E.flatMap(({ members, coordinators, statusLink }) => {
                // Here we would ideally fetch the status record from administration store
                // For now, we will leave status as undefined and rely on eventing
                const organization = createUIOrganizationFromRecord(
                  record,
                  members.map((link) => link.target),
                  coordinators.map((link) => link.target)
                );
                E.runSync(cache.set(original_action_hash.toString(), organization));
                return E.succeed(organization);
              })
            );
          }),
          E.mapError((e) => OrganizationStoreError.getOrganization(e))
        )
      )(setLoading, setError);

    const getOrganizationByActionHash = (
      actionHash: ActionHash
    ): E.Effect<UIOrganization | null, OrganizationStoreError> =>
      pipe(
        cache.get(actionHash.toString()),
        E.catchAll(() => getLatestOrganization(actionHash))
      );

    const setCurrentOrganization = (
      organization: UIOrganization
    ): E.Effect<void, OrganizationStoreError> =>
      E.sync(() => {
        currentOrganization = organization;
      });

    const getAcceptedOrganizations = (): E.Effect<UIOrganization[], OrganizationStoreError> =>
      withLoadingState(() =>
        pipe(
          organizationsService.getAcceptedOrganizationsLinks(),
          E.flatMap((links) =>
            E.all(links.map((link) => getOrganizationByActionHash(link.target)))
          ),
          E.map((orgs) => {
            const validOrgs = orgs.filter((o): o is UIOrganization => o !== null);
            acceptedOrganizations.splice(0, acceptedOrganizations.length, ...validOrgs);
            return validOrgs;
          }),
          E.mapError((e) => OrganizationStoreError.getAcceptedOrganizations(e))
        )
      )(setLoading, setError);

    const memberAction = (
      action: 'add' | 'remove',
      organization_original_action_hash: ActionHash,
      memberActionHash: ActionHash
    ): E.Effect<boolean, OrganizationStoreError> => {
      const serviceCall =
        action === 'add'
          ? organizationsService.addOrganizationMember
          : organizationsService.removeOrganizationMember;
      const errorContext = action === 'add' ? 'ADD_MEMBER' : 'REMOVE_MEMBER';

      return withLoadingState(() =>
        pipe(
          serviceCall(organization_original_action_hash, memberActionHash),
          E.tap(() => E.runSync(cache.invalidate(organization_original_action_hash.toString()))),
          E.mapError((e) => OrganizationStoreError.fromError(e, ERROR_CONTEXTS[errorContext]))
        )
      )(setLoading, setError);
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
    ): E.Effect<boolean, OrganizationStoreError> => {
      const serviceCall =
        action === 'add'
          ? organizationsService.addOrganizationCoordinator
          : organizationsService.removeOrganizationCoordinator;
      const errorContext = action === 'add' ? 'ADD_COORDINATOR' : 'REMOVE_COORDINATOR';

      return withLoadingState(() =>
        pipe(
          serviceCall(organization_original_action_hash, coordinatorActionHash),
          E.tap(() => E.runSync(cache.invalidate(organization_original_action_hash.toString()))),
          E.mapError((e) => OrganizationStoreError.fromError(e, ERROR_CONTEXTS[errorContext]))
        )
      )(setLoading, setError);
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
    ): E.Effect<UIOrganization | null, OrganizationStoreError> =>
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
                  storeEventBus.emit('organization:updated', { organization: refreshedOrg });
                }
              })
            );
          }),
          E.mapError((e) => OrganizationStoreError.updateOrganization(e, hash.toString()))
        )
      )(setLoading, setError);

    const deleteOrganization = (
      organization_original_action_hash: ActionHash
    ): E.Effect<boolean, OrganizationStoreError> =>
      withLoadingState(() =>
        pipe(
          organizationsService.deleteOrganization(organization_original_action_hash),
          E.tap(() => {
            E.runSync(cache.invalidate(organization_original_action_hash.toString()));
            storeEventBus.emit('organization:deleted', {
              organizationHash: organization_original_action_hash
            });
          }),
          E.mapError((e) =>
            OrganizationStoreError.deleteOrganization(
              e,
              organization_original_action_hash.toString()
            )
          )
        )
      )(setLoading, setError);

    const leaveOrganization = (hash: ActionHash): E.Effect<boolean, OrganizationStoreError> =>
      withLoadingState(() =>
        pipe(
          organizationsService.leaveOrganization(hash),
          E.tap(() => {
            E.runSync(cache.invalidate(hash.toString()));
            // We may need a specific event for leaving
          }),
          E.mapError((e) => OrganizationStoreError.leaveOrganization(e, hash.toString()))
        )
      )(setLoading, setError);

    const isOrganizationCoordinator = (
      orgHash: ActionHash,
      userHash: ActionHash
    ): E.Effect<boolean, OrganizationStoreError> =>
      pipe(
        organizationsService.isOrganizationCoordinator(orgHash, userHash),
        E.mapError((e) =>
          OrganizationStoreError.isOrganizationCoordinator(
            e,
            orgHash.toString(),
            userHash.toString()
          )
        )
      );

    const getUserOrganizations = (
      userHash: ActionHash
    ): E.Effect<UIOrganization[], OrganizationStoreError> =>
      withLoadingState(() =>
        pipe(
          organizationsService.getUserOrganizationsLinks(userHash),
          E.flatMap((links) =>
            E.all(links.map((link) => getOrganizationByActionHash(link.target)))
          ),
          E.map((orgs) => orgs.filter((o): o is UIOrganization => o !== null)),
          E.mapError((e) => OrganizationStoreError.getUserOrganizations(e))
        )
      )(setLoading, setError);

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

let _organizationsStore: OrganizationsStore | null = null;

const getOrganizationsStore = (): OrganizationsStore => {
  if (!_organizationsStore) {
    _organizationsStore = pipe(
      createOrganizationsStore(),
      E.provide(OrganizationsServiceLive),
      E.provide(CacheServiceLive),
      E.provide(HolochainClientLive),
      E.runSync
    );
  }
  return _organizationsStore;
};

const organizationsStore: OrganizationsStore = new Proxy({} as OrganizationsStore, {
  get(_target, prop) {
    const store = getOrganizationsStore();
    const value = store[prop as keyof OrganizationsStore];
    return typeof value === 'function' ? value.bind(store) : value;
  }
});

export default organizationsStore;
