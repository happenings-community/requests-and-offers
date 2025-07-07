/* eslint-disable @typescript-eslint/no-explicit-any */
import { HreaServiceTag, HreaServiceLive } from '@/lib/services/hrea.service';
import { Effect as E, Layer, pipe } from 'effect';
import { HolochainClientLive } from '$lib/services/holochainClient.service';
import { storeEventBus } from '$lib/stores/storeEvents';
import { HreaError } from '$lib/errors';
import type { Agent, ResourceSpecification } from '$lib/types/hrea';
import type { ApolloClient } from '@apollo/client/core';
import type { UIUser, UIOrganization, UIServiceType } from '$lib/types/ui';

// ============================================================================
// CONSTANTS
// ============================================================================

const ERROR_CONTEXTS = {
  INITIALIZE: 'Failed to initialize hREA service',
  CREATE_PERSON: 'Failed to create person agent',
  UPDATE_PERSON: 'Failed to update person agent',
  GET_ALL_AGENTS: 'Failed to get all agents',
  RETROACTIVE_MAPPING: 'Failed to create retroactive mappings',
  CREATE_RESOURCE_SPECIFICATION: 'Failed to create resource specification',
  UPDATE_RESOURCE_SPECIFICATION: 'Failed to update resource specification',
  DELETE_RESOURCE_SPECIFICATION: 'Failed to delete resource specification',
  GET_ALL_RESOURCE_SPECIFICATIONS: 'Failed to get all resource specifications'
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type HreaStore = {
  readonly userAgentMappings: ReadonlyMap<string, string>; // userHash -> agentId
  readonly organizationAgentMappings: ReadonlyMap<string, string>; // organizationHash -> agentId
  readonly serviceTypeResourceSpecMappings: ReadonlyMap<string, string>; // serviceTypeHash -> resourceSpecId
  readonly agents: ReadonlyArray<Agent>;
  readonly resourceSpecifications: ReadonlyArray<ResourceSpecification>;
  readonly loading: boolean;
  readonly error: HreaError | null;
  readonly apolloClient: ApolloClient<any> | null;
  readonly initialize: () => E.Effect<void, HreaError>;
  readonly createPersonFromUser: (user: UIUser) => E.Effect<Agent | null, HreaError>;
  readonly updatePersonAgent: (params: {
    agentId: string;
    user: UIUser;
  }) => E.Effect<Agent | null, HreaError>;
  readonly createOrganizationFromOrg: (
    organization: UIOrganization
  ) => E.Effect<Agent | null, HreaError>;
  readonly updateOrganizationAgent: (params: {
    agentId: string;
    organization: UIOrganization;
  }) => E.Effect<Agent | null, HreaError>;
  readonly createResourceSpecificationFromServiceType: (
    serviceType: UIServiceType
  ) => E.Effect<ResourceSpecification | null, HreaError>;
  readonly updateResourceSpecification: (params: {
    resourceSpecId: string;
    serviceType: UIServiceType;
  }) => E.Effect<ResourceSpecification | null, HreaError>;
  readonly deleteResourceSpecificationForServiceType: (
    serviceTypeHash: string
  ) => E.Effect<boolean, HreaError>;
  readonly getAllAgents: () => E.Effect<void, HreaError>;
  readonly getAllResourceSpecifications: () => E.Effect<void, HreaError>;
  readonly createRetroactiveMappings: (
    users: UIUser[],
    organizations: UIOrganization[]
  ) => E.Effect<void, HreaError>;
  readonly createRetroactiveResourceSpecMappings: (
    serviceTypes: UIServiceType[]
  ) => E.Effect<void, HreaError>;
  readonly dispose: () => void;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Creates a user-to-agent mapping data from a UIUser
 */
const createUserAgentMapping = (user: UIUser): { name: string; note: string } => {
  // Use name if available, fallback to nickname, then to 'Unknown User'
  const displayName = user.name || user.nickname || 'Unknown User';

  // Create a comprehensive note with user information
  const noteComponents = [
    user.bio || '',
    user.user_type ? `Type: ${user.user_type}` : '',
    user.location ? `Location: ${user.location}` : '',
    user.email ? `Email: ${user.email}` : '',
    user.time_zone ? `Timezone: ${user.time_zone}` : ''
  ].filter(Boolean);

  const note = noteComponents.length > 0 ? noteComponents.join(' | ') : 'User profile';

  return { name: displayName, note };
};

/**
 * Creates an organization-to-agent mapping data from a UIOrganization
 */
const createOrganizationAgentMapping = (
  organization: UIOrganization
): { name: string; note: string } => {
  const displayName = organization.name || 'Unknown Organization';

  // Create a comprehensive note with organization information
  const noteComponents = [
    organization.description || '',
    organization.location ? `Location: ${organization.location}` : '',
    organization.email ? `Email: ${organization.email}` : '',
    organization.urls && organization.urls.length > 0
      ? `URLs: ${organization.urls.join(', ')}`
      : '',
    organization.members && organization.members.length > 0
      ? `Members: ${organization.members.length}`
      : '',
    organization.coordinators && organization.coordinators.length > 0
      ? `Coordinators: ${organization.coordinators.length}`
      : ''
  ].filter(Boolean);

  const note = noteComponents.length > 0 ? noteComponents.join(' | ') : 'Organization profile';

  return { name: displayName, note };
};

/**
 * Creates a service-type-to-resource-specification mapping data from a UIServiceType
 */
const createServiceTypeResourceSpecMapping = (
  serviceType: UIServiceType
): { name: string; note?: string; classifiedAs?: string[] } => {
  const displayName = serviceType.name || 'Unknown Service Type';

  // Create a comprehensive note with service type information
  const noteComponents = [
    serviceType.description || '',
    serviceType.tags && serviceType.tags.length > 0 ? `Tags: ${serviceType.tags.join(', ')}` : '',
    `Status: ${serviceType.status || 'unknown'}`
  ].filter(Boolean);

  const note =
    noteComponents.length > 0 ? noteComponents.join(' | ') : 'Service type specification';

  // Determine classification based on service type characteristics
  const classifiedAs = ['http://www.productontology.org/id/Service'];

  // Add Medium of Exchange classification if needed
  // This could be determined by tags or other service type properties
  if (
    serviceType.tags?.some(
      (tag) =>
        tag.toLowerCase().includes('credit') ||
        tag.toLowerCase().includes('currency') ||
        tag.toLowerCase().includes('exchange') ||
        tag.toLowerCase().includes('token')
    )
  ) {
    classifiedAs.push('http://www.productontology.org/id/Medium_of_exchange');
  }

  return { name: displayName, note, classifiedAs };
};

/**
 * Creates a helper for ensuring initialization before operations
 */
const withInitialization = <T, E>(
  operation: () => E.Effect<T, E>,
  apolloClient: ApolloClient<any> | null,
  initialize: () => E.Effect<void, HreaError>
) =>
  pipe(
    E.void,
    E.flatMap(() => {
      if (!apolloClient) {
        return initialize();
      }
      return E.void;
    }),
    E.flatMap(() => operation())
  );

/**
 * Creates simple event handlers for entity synchronization
 */
const createEventHandlers = (
  createPersonFromUser: (user: UIUser) => E.Effect<Agent | null, HreaError>,
  updatePersonAgent: (params: {
    agentId: string;
    user: UIUser;
  }) => E.Effect<Agent | null, HreaError>,
  createOrganizationFromOrg: (organization: UIOrganization) => E.Effect<Agent | null, HreaError>,
  updateOrganizationAgent: (params: {
    agentId: string;
    organization: UIOrganization;
  }) => E.Effect<Agent | null, HreaError>,
  createResourceSpecificationFromServiceType: (
    serviceType: UIServiceType
  ) => E.Effect<ResourceSpecification | null, HreaError>,
  updateResourceSpecification: (params: {
    resourceSpecId: string;
    serviceType: UIServiceType;
  }) => E.Effect<ResourceSpecification | null, HreaError>,
  deleteResourceSpecificationForServiceType: (
    serviceTypeHash: string
  ) => E.Effect<boolean, HreaError>,
  userAgentMappings: Map<string, string>,
  organizationAgentMappings: Map<string, string>,
  serviceTypeResourceSpecMappings: Map<string, string>
) => {
  const handleUserCreated = (user: UIUser) => {
    pipe(createPersonFromUser(user), E.runPromise).catch((err) =>
      console.error('hREA Store: Failed to create person agent:', err)
    );
  };

  const handleUserUpdated = (user: UIUser) => {
    const userHash = user.original_action_hash?.toString();
    if (!userHash) return;

    const agentId = userAgentMappings.get(userHash);
    if (agentId) {
      // Update existing agent
      pipe(updatePersonAgent({ agentId, user }), E.runPromise).catch((err) =>
        console.error('hREA Store: Failed to update person agent:', err)
      );
    } else {
      // Create new agent if none exists
      pipe(createPersonFromUser(user), E.runPromise).catch((err) =>
        console.error('hREA Store: Failed to create person agent:', err)
      );
    }
  };

  const handleOrganizationCreated = (organization: UIOrganization) => {
    pipe(createOrganizationFromOrg(organization), E.runPromise).catch((err) =>
      console.error('hREA Store: Failed to create organization agent:', err)
    );
  };

  const handleOrganizationUpdated = (organization: UIOrganization) => {
    const organizationHash = organization.original_action_hash?.toString();
    if (!organizationHash) return;

    const agentId = organizationAgentMappings.get(organizationHash);
    if (agentId) {
      // Update existing agent
      pipe(updateOrganizationAgent({ agentId, organization }), E.runPromise).catch((err) =>
        console.error('hREA Store: Failed to update organization agent:', err)
      );
    } else {
      // Create new agent if none exists
      pipe(createOrganizationFromOrg(organization), E.runPromise).catch((err) =>
        console.error('hREA Store: Failed to create organization agent:', err)
      );
    }
  };

  const handleServiceTypeApproved = (serviceType: UIServiceType) => {
    // Only create ResourceSpecification when a ServiceType is approved
    console.log(
      'hREA Store: ServiceType approved, creating ResourceSpecification:',
      serviceType.name
    );

    // Create ResourceSpecification from the approved ServiceType
    pipe(createResourceSpecificationFromServiceType(serviceType), E.runPromise).catch((err) =>
      console.error(
        'hREA Store: Failed to create resource specification for approved service type:',
        err
      )
    );
  };

  const handleServiceTypeRejected = (serviceType: UIServiceType) => {
    // When a ServiceType is rejected, we might want to delete its ResourceSpecification
    const serviceTypeHash = serviceType.original_action_hash?.toString();
    if (serviceTypeHash) {
      const resourceSpecId = serviceTypeResourceSpecMappings.get(serviceTypeHash);
      if (resourceSpecId) {
        pipe(deleteResourceSpecificationForServiceType(serviceTypeHash), E.runPromise).catch(
          (err) =>
            console.error(
              'hREA Store: Failed to delete resource specification for rejected service type:',
              err
            )
        );
      }
    }
  };

  return {
    handleUserCreated,
    handleUserUpdated,
    handleOrganizationCreated,
    handleOrganizationUpdated,
    handleServiceTypeApproved,
    handleServiceTypeRejected
  };
};

/**
 * Creates event subscription handlers
 */
const createEventSubscriptions = (
  handleUserCreated: (user: UIUser) => void,
  handleUserUpdated: (user: UIUser) => void,
  handleOrganizationCreated: (organization: UIOrganization) => void,
  handleOrganizationUpdated: (organization: UIOrganization) => void,
  handleServiceTypeApproved: (serviceType: UIServiceType) => void,
  handleServiceTypeRejected: (serviceType: UIServiceType) => void
) => {
  const unsubscribeFunctions: Array<() => void> = [];

  // Subscribe to user creation events to auto-create person agents
  const unsubscribeUserCreated = storeEventBus.on('user:created', (payload) => {
    const { user } = payload;
    handleUserCreated(user);
  });

  // Subscribe to user update events for agent synchronization
  const unsubscribeUserUpdated = storeEventBus.on('user:updated', (payload) => {
    const { user } = payload;
    handleUserUpdated(user);
  });

  // Subscribe to organization creation events to auto-create organization agents
  const unsubscribeOrganizationCreated = storeEventBus.on('organization:created', (payload) => {
    const { organization } = payload;
    handleOrganizationCreated(organization);
  });

  // Subscribe to organization update events for agent synchronization
  const unsubscribeOrganizationUpdated = storeEventBus.on('organization:updated', (payload) => {
    const { organization } = payload;
    handleOrganizationUpdated(organization);
  });

  // Subscribe to service type approval events to create resource specifications
  const unsubscribeServiceTypeApproved = storeEventBus.on('serviceType:approved', (payload) => {
    const { serviceType } = payload;
    handleServiceTypeApproved(serviceType);
  });

  // Subscribe to service type rejection events to delete resource specifications
  const unsubscribeServiceTypeRejected = storeEventBus.on('serviceType:rejected', (payload) => {
    const { serviceType } = payload;
    handleServiceTypeRejected(serviceType);
  });

  unsubscribeFunctions.push(
    unsubscribeUserCreated,
    unsubscribeUserUpdated,
    unsubscribeOrganizationCreated,
    unsubscribeOrganizationUpdated,
    unsubscribeServiceTypeApproved,
    unsubscribeServiceTypeRejected
  );

  return {
    unsubscribeFunctions,
    cleanup: () => {
      unsubscribeFunctions.forEach((unsubscribe) => {
        unsubscribe();
      });
    }
  };
};

// ============================================================================
// STORE FACTORY FUNCTION
// ============================================================================

export const createHreaStore = (): E.Effect<HreaStore, never, HreaServiceTag> =>
  E.gen(function* () {
    const hreaService = yield* HreaServiceTag;

    // ========================================================================
    // STATE INITIALIZATION
    // ========================================================================
    const state = $state({
      userAgentMappings: new Map<string, string>(), // userHash -> agentId
      organizationAgentMappings: new Map<string, string>(), // organizationHash -> agentId
      serviceTypeResourceSpecMappings: new Map<string, string>(), // serviceTypeHash -> resourceSpecId
      agents: [] as Agent[],
      resourceSpecifications: [] as ResourceSpecification[],
      loading: false,
      error: null as HreaError | null,
      apolloClient: null as ApolloClient<any> | null,
      eventSubscriptionsActive: false
    });

    // Track in-flight operations to prevent race conditions
    const inFlightOperations = new Set<string>();

    // ========================================================================
    // HELPER INITIALIZATION
    // ========================================================================
    const setLoading = (loading: boolean) => {
      state.loading = loading;
    };

    const setError = (error: HreaError | null) => {
      state.error = error;
    };

    const addUserAgentMapping = (userHash: string, agentId: string) => {
      state.userAgentMappings.set(userHash, agentId);
    };

    const addOrganizationAgentMapping = (organizationHash: string, agentId: string) => {
      state.organizationAgentMappings.set(organizationHash, agentId);
    };

    const addServiceTypeResourceSpecMapping = (serviceTypeHash: string, resourceSpecId: string) => {
      state.serviceTypeResourceSpecMappings.set(serviceTypeHash, resourceSpecId);
    };

    // ========================================================================
    // STORE METHODS
    // ========================================================================

    const initialize = (): E.Effect<void, HreaError> => {
      setLoading(true);

      return pipe(
        hreaService.initialize(),
        E.tap((client) =>
          E.sync(() => {
            state.apolloClient = client;
          })
        ),
        E.asVoid,
        E.ensuring(E.sync(() => setLoading(false))),
        E.mapError((error) => HreaError.fromError(error, ERROR_CONTEXTS.INITIALIZE))
      );
    };

    const createPersonFromUser = (user: UIUser): E.Effect<Agent | null, HreaError> => {
      const userHash = user.original_action_hash?.toString();

      if (!userHash) {
        console.warn('hREA Store: Cannot create agent for user without action hash');
        return E.succeed(null);
      }

      // Check if operation is already in flight
      if (inFlightOperations.has(userHash)) {
        return E.succeed(null);
      }

      // Check if we already have a mapping for this user
      if (state.userAgentMappings.has(userHash)) {
        return E.succeed(null);
      }

      const { name, note } = createUserAgentMapping(user);

      // Mark operation as in-flight
      inFlightOperations.add(userHash);

      return pipe(
        withInitialization(
          () => hreaService.createPerson({ name, note }),
          state.apolloClient,
          initialize
        ),
        E.tap((newAgent) =>
          E.sync(() => {
            addUserAgentMapping(userHash, newAgent.id);
            // Add the new agent to the agents list immediately
            state.agents = [...state.agents, newAgent];
          })
        ),
        E.tapError((error) =>
          E.sync(() => {
            console.error(`hREA Store: Failed to create Person Agent for user "${name}":`, error);
          })
        ),
        E.ensuring(
          E.sync(() => {
            // Always remove from in-flight operations
            inFlightOperations.delete(userHash);
          })
        ),
        E.mapError((error) => HreaError.fromError(error, ERROR_CONTEXTS.CREATE_PERSON))
      );
    };

    const updatePersonAgent = (params: {
      agentId: string;
      user: UIUser;
    }): E.Effect<Agent | null, HreaError> => {
      const userHash = params.user.original_action_hash?.toString();

      if (!userHash) {
        console.warn('hREA Store: Cannot update agent for user without action hash');
        return E.succeed(null);
      }

      // Check if operation is already in flight
      if (inFlightOperations.has(`update-${userHash}`)) {
        return E.succeed(null);
      }

      const { name, note } = createUserAgentMapping(params.user);

      // Mark operation as in-flight
      inFlightOperations.add(`update-${userHash}`);

      return pipe(
        withInitialization(
          () =>
            hreaService.updatePerson({
              id: params.agentId,
              name,
              note
            }),
          state.apolloClient,
          initialize
        ),
        E.tapError((error) =>
          E.sync(() => {
            console.error(`hREA Store: Failed to update Person Agent for user "${name}":`, error);
          })
        ),
        E.ensuring(
          E.sync(() => {
            // Always remove from in-flight operations
            inFlightOperations.delete(`update-${userHash}`);
          })
        ),
        E.mapError((error) => HreaError.fromError(error, ERROR_CONTEXTS.UPDATE_PERSON))
      );
    };

    const createOrganizationFromOrg = (
      organization: UIOrganization
    ): E.Effect<Agent | null, HreaError> => {
      const organizationHash = organization.original_action_hash?.toString();

      if (!organizationHash) {
        console.warn('hREA Store: Cannot create agent for organization without action hash');
        return E.succeed(null);
      }

      // Check if agent already exists
      if (state.organizationAgentMappings.has(organizationHash)) {
        console.warn(
          `hREA Store: Organization Agent already exists for organization ${organization.name}`
        );
        return E.succeed(null);
      }

      // Check if operation is already in flight
      if (inFlightOperations.has(`create-org-${organizationHash}`)) {
        return E.succeed(null);
      }

      const { name, note } = createOrganizationAgentMapping(organization);

      // Mark operation as in-flight
      inFlightOperations.add(`create-org-${organizationHash}`);

      return pipe(
        withInitialization(
          () =>
            hreaService.createOrganization({
              name,
              note
            }),
          state.apolloClient,
          initialize
        ),
        E.tap((agent) =>
          E.sync(() => {
            console.log(
              `hREA Store: Created Organization Agent "${agent.name}" with ID: ${agent.id}`
            );
            addOrganizationAgentMapping(organizationHash, agent.id);
            // Add the new agent to the agents list immediately
            state.agents = [...state.agents, agent];
          })
        ),
        E.tapError((error) =>
          E.sync(() => {
            console.error(`hREA Store: Failed to create Organization Agent for "${name}":`, error);
          })
        ),
        E.ensuring(
          E.sync(() => {
            // Always remove from in-flight operations
            inFlightOperations.delete(`create-org-${organizationHash}`);
          })
        ),
        E.mapError((error) => HreaError.fromError(error, ERROR_CONTEXTS.CREATE_PERSON))
      );
    };

    const updateOrganizationAgent = (params: {
      agentId: string;
      organization: UIOrganization;
    }): E.Effect<Agent | null, HreaError> => {
      const organizationHash = params.organization.original_action_hash?.toString();

      if (!organizationHash) {
        console.warn('hREA Store: Cannot update agent for organization without action hash');
        return E.succeed(null);
      }

      // Check if operation is already in flight
      if (inFlightOperations.has(`update-org-${organizationHash}`)) {
        return E.succeed(null);
      }

      const { name, note } = createOrganizationAgentMapping(params.organization);

      // Mark operation as in-flight
      inFlightOperations.add(`update-org-${organizationHash}`);

      return pipe(
        withInitialization(
          () =>
            hreaService.updateOrganization({
              id: params.agentId,
              name,
              note
            }),
          state.apolloClient,
          initialize
        ),
        E.tapError((error) =>
          E.sync(() => {
            console.error(
              `hREA Store: Failed to update Organization Agent for organization "${name}":`,
              error
            );
          })
        ),
        E.ensuring(
          E.sync(() => {
            // Always remove from in-flight operations
            inFlightOperations.delete(`update-org-${organizationHash}`);
          })
        ),
        E.mapError((error) => HreaError.fromError(error, ERROR_CONTEXTS.UPDATE_PERSON))
      );
    };

    const getAllAgents = (): E.Effect<void, HreaError> => {
      return pipe(
        E.sync(() => setLoading(true)),
        E.flatMap(() =>
          withInitialization(() => hreaService.getAgents(), state.apolloClient, initialize)
        ),
        E.tap((fetchedAgents) =>
          E.sync(() => {
            state.agents = [...fetchedAgents];
            setLoading(false);
          })
        ),
        E.tapError((error) =>
          E.sync(() => {
            setError(HreaError.fromError(error, ERROR_CONTEXTS.GET_ALL_AGENTS));
            setLoading(false);
          })
        ),
        E.asVoid
      );
    };

    // ========================================================================
    // RESOURCE SPECIFICATION METHODS
    // ========================================================================

    const createResourceSpecificationFromServiceType = (
      serviceType: UIServiceType
    ): E.Effect<ResourceSpecification | null, HreaError> => {
      const serviceTypeHash = serviceType.original_action_hash?.toString();

      if (!serviceTypeHash) {
        console.warn(
          'hREA Store: Cannot create resource specification for service type without action hash'
        );
        return E.succeed(null);
      }

      // Check if we already have a mapping for this service type
      if (state.serviceTypeResourceSpecMappings.has(serviceTypeHash)) {
        return E.succeed(null);
      }

      const { name, note, classifiedAs } = createServiceTypeResourceSpecMapping(serviceType);

      return pipe(
        withInitialization(
          () => hreaService.createResourceSpecification({ name, note, classifiedAs }),
          state.apolloClient,
          initialize
        ),
        E.tap((newResourceSpec) =>
          E.sync(() => {
            addServiceTypeResourceSpecMapping(serviceTypeHash, newResourceSpec.id);
            // Add the new resource specification to the list immediately
            state.resourceSpecifications = [...state.resourceSpecifications, newResourceSpec];
          })
        ),
        E.tapError((error) =>
          E.sync(() => {
            console.error(
              `hREA Store: Failed to create Resource Specification for service type "${name}":`,
              error
            );
          })
        ),
        E.mapError((error) =>
          HreaError.fromError(error, ERROR_CONTEXTS.CREATE_RESOURCE_SPECIFICATION)
        )
      );
    };

    const updateResourceSpecification = (params: {
      resourceSpecId: string;
      serviceType: UIServiceType;
    }): E.Effect<ResourceSpecification | null, HreaError> => {
      const { name, note, classifiedAs } = createServiceTypeResourceSpecMapping(params.serviceType);

      return pipe(
        withInitialization(
          () =>
            hreaService.updateResourceSpecification({
              id: params.resourceSpecId,
              name,
              note,
              classifiedAs
            }),
          state.apolloClient,
          initialize
        ),
        E.tapError((error) =>
          E.sync(() => {
            console.error(`hREA Store: Failed to update Resource Specification "${name}":`, error);
          })
        ),
        E.mapError((error) =>
          HreaError.fromError(error, ERROR_CONTEXTS.UPDATE_RESOURCE_SPECIFICATION)
        )
      );
    };

    const deleteResourceSpecificationForServiceType = (
      serviceTypeHash: string
    ): E.Effect<boolean, HreaError> => {
      const resourceSpecId = state.serviceTypeResourceSpecMappings.get(serviceTypeHash);

      if (!resourceSpecId) {
        console.warn(
          'hREA Store: No resource specification found for service type hash:',
          serviceTypeHash
        );
        return E.succeed(false);
      }

      return pipe(
        withInitialization(
          () => hreaService.deleteResourceSpecification({ id: resourceSpecId }),
          state.apolloClient,
          initialize
        ),
        E.tap(() =>
          E.sync(() => {
            // Remove from mapping
            state.serviceTypeResourceSpecMappings.delete(serviceTypeHash);
            // Remove from resource specifications array
            state.resourceSpecifications = state.resourceSpecifications.filter(
              (spec) => spec.id !== resourceSpecId
            );
          })
        ),
        E.map(() => true),
        E.tapError((error) =>
          E.sync(() => {
            console.error(
              `hREA Store: Failed to delete Resource Specification for service type:`,
              error
            );
          })
        ),
        E.mapError((error) =>
          HreaError.fromError(error, ERROR_CONTEXTS.DELETE_RESOURCE_SPECIFICATION)
        )
      );
    };

    const getAllResourceSpecifications = (): E.Effect<void, HreaError> => {
      return pipe(
        E.sync(() => setLoading(true)),
        E.flatMap(() =>
          withInitialization(
            () => hreaService.getResourceSpecifications(),
            state.apolloClient,
            initialize
          )
        ),
        E.tap((fetchedResourceSpecs) =>
          E.sync(() => {
            console.log('hREA Store: Loaded resource specifications:', fetchedResourceSpecs.length);
            state.resourceSpecifications = [...fetchedResourceSpecs];
            setLoading(false);
          })
        ),
        E.tapError((error) =>
          E.sync(() => {
            console.error('hREA Store: Failed to load resource specifications:', error);
            setError(HreaError.fromError(error, ERROR_CONTEXTS.GET_ALL_RESOURCE_SPECIFICATIONS));
            setLoading(false);
          })
        ),
        E.asVoid
      );
    };

    /**
     * Creates mappings for existing users and organizations who have agents but no mappings.
     * This handles the case where entities were created before hREA store was listening.
     * NOTE: This is a temporary solution based on name matching. The long-term plan
     * is to store agentId directly on entries in the users_organizations zome.
     */
    const createRetroactiveMappings = (
      users: UIUser[],
      organizations: UIOrganization[]
    ): E.Effect<void, HreaError> => {
      return pipe(
        withInitialization(() => hreaService.getAgents(), state.apolloClient, initialize),
        E.tap((agents) =>
          E.sync(() => {
            agents.forEach((agent) => {
              // Check for existing user mapping
              const existingUserMapping = Array.from(state.userAgentMappings.entries()).find(
                ([_, agentId]) => agentId === agent.id
              );

              // Check for existing organization mapping
              const existingOrgMapping = Array.from(state.organizationAgentMappings.entries()).find(
                ([_, agentId]) => agentId === agent.id
              );

              if (existingUserMapping || existingOrgMapping) {
                return;
              }

              // Try to find matching user by name (temporary solution)
              const matchingUser = users.find((user) => {
                return user.name === agent.name || user.nickname === agent.name;
              });

              if (matchingUser && matchingUser.original_action_hash) {
                const userHash = matchingUser.original_action_hash.toString();
                addUserAgentMapping(userHash, agent.id);
                return;
              }

              // Try to find matching organization by name (temporary solution)
              const matchingOrganization = organizations.find((org) => {
                return org.name === agent.name;
              });

              if (matchingOrganization && matchingOrganization.original_action_hash) {
                const organizationHash = matchingOrganization.original_action_hash.toString();
                addOrganizationAgentMapping(organizationHash, agent.id);
              }
            });
          })
        ),
        E.asVoid,
        E.catchAll(() => E.void), // Don't fail the store creation if this fails
        E.mapError((error) => HreaError.fromError(error, ERROR_CONTEXTS.RETROACTIVE_MAPPING))
      );
    };

    const createRetroactiveResourceSpecMappings = (
      serviceTypes: UIServiceType[]
    ): E.Effect<void, HreaError> => {
      return pipe(
        withInitialization(
          () => hreaService.getResourceSpecifications(),
          state.apolloClient,
          initialize
        ),
        E.tap((resourceSpecs) =>
          E.sync(() => {
            resourceSpecs.forEach((resourceSpec) => {
              // Check for existing mapping
              const existingMapping = Array.from(
                state.serviceTypeResourceSpecMappings.entries()
              ).find(([_, resourceSpecId]) => resourceSpecId === resourceSpec.id);

              if (existingMapping) {
                return;
              }

              // Try to find matching service type by name (temporary solution)
              const matchingServiceType = serviceTypes.find((serviceType) => {
                return serviceType.name === resourceSpec.name && serviceType.status === 'approved';
              });

              if (matchingServiceType && matchingServiceType.original_action_hash) {
                const serviceTypeHash = matchingServiceType.original_action_hash.toString();
                addServiceTypeResourceSpecMapping(serviceTypeHash, resourceSpec.id);
              }
            });
          })
        ),
        E.asVoid,
        E.catchAll(() => E.void), // Don't fail the store creation if this fails
        E.mapError((error) => HreaError.fromError(error, ERROR_CONTEXTS.RETROACTIVE_MAPPING))
      );
    };

    // ========================================================================
    // EVENT SETUP AND CLEANUP
    // ========================================================================

    const {
      handleUserCreated,
      handleUserUpdated,
      handleOrganizationCreated,
      handleOrganizationUpdated,
      handleServiceTypeApproved,
      handleServiceTypeRejected
    } = createEventHandlers(
      createPersonFromUser,
      updatePersonAgent,
      createOrganizationFromOrg,
      updateOrganizationAgent,
      createResourceSpecificationFromServiceType,
      updateResourceSpecification,
      deleteResourceSpecificationForServiceType,
      state.userAgentMappings,
      state.organizationAgentMappings,
      state.serviceTypeResourceSpecMappings
    );

    const { cleanup: cleanupEventSubscriptions } = createEventSubscriptions(
      handleUserCreated,
      handleUserUpdated,
      handleOrganizationCreated,
      handleOrganizationUpdated,
      handleServiceTypeApproved,
      handleServiceTypeRejected
    );

    const dispose = () => {
      // Clear in-flight operations
      inFlightOperations.clear();

      // Unsubscribe from all events
      cleanupEventSubscriptions();

      // Reset state
      state.eventSubscriptionsActive = false;
    };

    // ========================================================================
    // STORE INTERFACE RETURN
    // ========================================================================

    return {
      get userAgentMappings() {
        return state.userAgentMappings;
      },
      get organizationAgentMappings() {
        return state.organizationAgentMappings;
      },
      get serviceTypeResourceSpecMappings() {
        return state.serviceTypeResourceSpecMappings;
      },
      get agents() {
        return state.agents; // Simplified - no longer injects mappings
      },
      get resourceSpecifications() {
        return state.resourceSpecifications;
      },
      get loading() {
        return state.loading;
      },
      get error() {
        return state.error;
      },
      get apolloClient() {
        return state.apolloClient;
      },
      initialize,
      createPersonFromUser,
      updatePersonAgent,
      createOrganizationFromOrg,
      updateOrganizationAgent,
      createResourceSpecificationFromServiceType,
      updateResourceSpecification,
      deleteResourceSpecificationForServiceType,
      getAllAgents,
      getAllResourceSpecifications,
      createRetroactiveMappings,
      createRetroactiveResourceSpecMappings,
      dispose
    };
  });

// ============================================================================
// STORE INSTANCE CREATION
// ============================================================================

// Lazy store initialization to avoid runtime issues
let _hreaStore: HreaStore | null = null;

const getHreaStore = (): HreaStore => {
  if (!_hreaStore) {
    _hreaStore = pipe(
      createHreaStore(),
      E.provide(HreaServiceLive),
      E.provide(HolochainClientLive),
      E.runSync
    );
  }
  return _hreaStore;
};

// Export a proxy that delegates to the lazy-initialized store
const hreaStore = new Proxy({} as HreaStore, {
  get(_target, prop) {
    const store = getHreaStore();
    const value = store[prop as keyof HreaStore];
    return typeof value === 'function' ? value.bind(store) : value;
  }
});

export default hreaStore;
