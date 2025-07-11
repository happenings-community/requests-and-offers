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
  readonly syncUserToAgent: (user: UIUser) => E.Effect<Agent | null, HreaError>;
  readonly syncOrganizationToAgent: (
    organization: UIOrganization
  ) => E.Effect<Agent | null, HreaError>;
  readonly syncServiceTypeToResourceSpec: (
    serviceType: UIServiceType
  ) => E.Effect<ResourceSpecification | null, HreaError>;
  readonly findAgentByActionHash: (
    actionHash: string,
    entityType: 'user' | 'organization'
  ) => Agent | null;
  readonly findResourceSpecByActionHash: (actionHash: string) => ResourceSpecification | null;
  readonly dispose: () => void;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Creates user-to-agent mapping data with action hash reference
 */
const createUserAgentMapping = (user: UIUser): { name: string; note: string } => {
  // Use name if available, fallback to nickname, then to 'Unknown User'
  const displayName = user.name || user.nickname || 'Unknown User';

  // Store the action hash as the primary reference, with minimal additional info
  const actionHashRef = user.original_action_hash?.toString() || 'unknown';
  const note = `ref:user:${actionHashRef}`;

  return { name: displayName, note };
};

/**
 * Creates organization-to-agent mapping data with action hash reference
 */
const createOrganizationAgentMapping = (
  organization: UIOrganization
): { name: string; note: string } => {
  const displayName = organization.name || 'Unknown Organization';

  // Store the action hash as the primary reference
  const actionHashRef = organization.original_action_hash?.toString() || 'unknown';
  const note = `ref:organization:${actionHashRef}`;

  return { name: displayName, note };
};

/**
 * Creates service-type-to-resource-specification mapping data with action hash reference
 */
const createServiceTypeResourceSpecMapping = (
  serviceType: UIServiceType
): { name: string; note?: string } => {
  const displayName = serviceType.name || 'Unknown Service Type';

  // Store the action hash as the primary reference
  const actionHashRef = serviceType.original_action_hash?.toString() || 'unknown';
  const note = `ref:serviceType:${actionHashRef}`;

  return { name: displayName, note };
};

/**
 * Extracts action hash from a note reference
 */
const extractActionHashFromNote = (
  note: string,
  entityType: 'user' | 'organization' | 'serviceType'
): string | null => {
  const prefix = `ref:${entityType}:`;
  if (note.startsWith(prefix)) {
    return note.substring(prefix.length);
  }
  return null;
};

/**
 * Finds an hREA agent by original action hash reference
 */
const findAgentByActionHash = (
  agents: Agent[],
  actionHash: string,
  entityType: 'user' | 'organization'
): Agent | null => {
  return (
    agents.find((agent) => {
      if (!agent.note) return false;
      const extractedHash = extractActionHashFromNote(agent.note, entityType);
      return extractedHash === actionHash;
    }) || null
  );
};

/**
 * Finds an hREA resource specification by original action hash reference
 */
const findResourceSpecByActionHash = (
  resourceSpecs: ResourceSpecification[],
  actionHash: string
): ResourceSpecification | null => {
  return (
    resourceSpecs.find((spec) => {
      if (!spec.note) return false;
      const extractedHash = extractActionHashFromNote(spec.note, 'serviceType');
      return extractedHash === actionHash;
    }) || null
  );
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
 * Creates simplified event handlers for entity synchronization
 */
const createEventHandlers = (
  createPersonFromUser: (user: UIUser) => E.Effect<Agent | null, HreaError>,
  createOrganizationFromOrg: (organization: UIOrganization) => E.Effect<Agent | null, HreaError>,
  createResourceSpecificationFromServiceType: (
    serviceType: UIServiceType
  ) => E.Effect<ResourceSpecification | null, HreaError>,
  deleteResourceSpecificationForServiceType: (
    serviceTypeHash: string
  ) => E.Effect<boolean, HreaError>,
  deleteAgentForOrganization: (organizationHash: string) => E.Effect<boolean, HreaError>
) => {
  const handleUserCreated = (user: UIUser) => {
    pipe(createPersonFromUser(user), E.runPromise).catch((err) =>
      console.error('hREA Store: Failed to create person agent:', err)
    );
  };

  const handleOrganizationCreated = (organization: UIOrganization) => {
    pipe(createOrganizationFromOrg(organization), E.runPromise).catch((err) =>
      console.error('hREA Store: Failed to create organization agent:', err)
    );
  };

  const handleServiceTypeCreated = (serviceType: UIServiceType) => {
    // Handle service types created by admins (which are automatically approved)
    // Only create ResourceSpecification for approved service types
    if (serviceType.status === 'approved') {
      console.log(
        'hREA Store: Admin-created ServiceType (auto-approved), creating ResourceSpecification:',
        serviceType.name
      );

      pipe(createResourceSpecificationFromServiceType(serviceType), E.runPromise).catch((err) =>
        console.error(
          'hREA Store: Failed to create resource specification for admin-created service type:',
          err
        )
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
    // When a ServiceType is rejected, we delete its ResourceSpecification
    const serviceTypeHash = serviceType.original_action_hash?.toString();
    if (serviceTypeHash) {
      console.log(
        'hREA Store: ServiceType rejected, removing ResourceSpecification:',
        serviceType.name
      );
      pipe(deleteResourceSpecificationForServiceType(serviceTypeHash), E.runPromise).catch((err) =>
        console.error(
          'hREA Store: Failed to delete resource specification for rejected service type:',
          err
        )
      );
    }
  };

  const handleServiceTypeDeleted = (serviceTypeHash: string) => {
    // When a ServiceType is deleted, remove its corresponding ResourceSpecification
    console.log(
      'hREA Store: ServiceType deleted, removing ResourceSpecification:',
      serviceTypeHash
    );
    pipe(deleteResourceSpecificationForServiceType(serviceTypeHash), E.runPromise).catch((err) =>
      console.error(
        'hREA Store: Failed to delete resource specification for deleted service type:',
        err
      )
    );
  };

  const handleOrganizationDeleted = (organizationHash: string) => {
    // When an Organization is deleted, remove its corresponding Agent
    console.log('hREA Store: Organization deleted, removing Agent:', organizationHash);
    pipe(deleteAgentForOrganization(organizationHash), E.runPromise).catch((err) =>
      console.error('hREA Store: Failed to delete agent for deleted organization:', err)
    );
  };

  return {
    handleUserCreated,
    handleOrganizationCreated,
    handleServiceTypeCreated,
    handleServiceTypeApproved,
    handleServiceTypeRejected,
    handleServiceTypeDeleted,
    handleOrganizationDeleted
  };
};

/**
 * Creates event subscription handlers (simplified - no automatic updates)
 */
const createEventSubscriptions = (
  handleUserCreated: (user: UIUser) => void,
  handleOrganizationCreated: (organization: UIOrganization) => void,
  handleServiceTypeCreated: (serviceType: UIServiceType) => void,
  handleServiceTypeApproved: (serviceType: UIServiceType) => void,
  handleServiceTypeRejected: (serviceType: UIServiceType) => void,
  handleServiceTypeDeleted: (serviceTypeHash: string) => void,
  handleOrganizationDeleted: (organizationHash: string) => void
) => {
  const unsubscribeFunctions: Array<() => void> = [];

  // Subscribe to creation events to auto-create hREA entities
  const unsubscribeUserCreated = storeEventBus.on('user:created', (payload) => {
    const { user } = payload;
    handleUserCreated(user);
  });

  const unsubscribeOrganizationCreated = storeEventBus.on('organization:created', (payload) => {
    const { organization } = payload;
    handleOrganizationCreated(organization);
  });

  const unsubscribeServiceTypeCreated = storeEventBus.on('serviceType:created', (payload) => {
    const { serviceType } = payload;
    handleServiceTypeCreated(serviceType);
  });

  // Subscribe to service type status events
  const unsubscribeServiceTypeApproved = storeEventBus.on('serviceType:approved', (payload) => {
    const { serviceType } = payload;
    handleServiceTypeApproved(serviceType);
  });

  const unsubscribeServiceTypeRejected = storeEventBus.on('serviceType:rejected', (payload) => {
    const { serviceType } = payload;
    handleServiceTypeRejected(serviceType);
  });

  const unsubscribeServiceTypeDeleted = storeEventBus.on('serviceType:deleted', (payload) => {
    const { serviceTypeHash } = payload;
    handleServiceTypeDeleted(serviceTypeHash.toString());
  });

  const unsubscribeOrganizationDeleted = storeEventBus.on('organization:deleted', (payload) => {
    const { organizationHash } = payload;
    handleOrganizationDeleted(organizationHash.toString());
  });

  unsubscribeFunctions.push(
    unsubscribeUserCreated,
    unsubscribeOrganizationCreated,
    unsubscribeServiceTypeCreated,
    unsubscribeServiceTypeApproved,
    unsubscribeServiceTypeRejected,
    unsubscribeServiceTypeDeleted,
    unsubscribeOrganizationDeleted
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

      // Check if the operation is already in flight
      if (inFlightOperations.has(userHash)) {
        return E.succeed(null);
      }

      // Check if we already have an agent for this user
      const existingAgent = findAgentByActionHash(state.agents, userHash, 'user');
      if (existingAgent) {
        console.log('hREA Store: Agent already exists for user:', user.name);
        addUserAgentMapping(userHash, existingAgent.id);
        return E.succeed(existingAgent);
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
      const { name, note } = createUserAgentMapping(params.user);

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
        E.tap((updatedAgent) =>
          E.sync(() => {
            if (updatedAgent) {
              // Update the agent in the agent array
              const index = state.agents.findIndex((agent) => agent.id === updatedAgent.id);
              if (index !== -1) {
                state.agents[index] = updatedAgent;
              }
            }
          })
        ),
        E.tapError((error) =>
          E.sync(() => {
            console.error(`hREA Store: Failed to update Person Agent for user "${name}":`, error);
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

      // Check if the operation is already in flight
      if (inFlightOperations.has(`create-org-${organizationHash}`)) {
        return E.succeed(null);
      }

      // Check if we already have an agent for this organization
      const existingAgent = findAgentByActionHash(state.agents, organizationHash, 'organization');
      if (existingAgent) {
        console.log('hREA Store: Agent already exists for organization:', organization.name);
        addOrganizationAgentMapping(organizationHash, existingAgent.id);
        return E.succeed(existingAgent);
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
      const { name, note } = createOrganizationAgentMapping(params.organization);

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
        E.tap((updatedAgent) =>
          E.sync(() => {
            if (updatedAgent) {
              // Update the agent in the agents array
              const index = state.agents.findIndex((agent) => agent.id === updatedAgent.id);
              if (index !== -1) {
                state.agents[index] = updatedAgent;
              }
            }
          })
        ),
        E.tapError((error) =>
          E.sync(() => {
            console.error(
              `hREA Store: Failed to update Organization Agent for organization "${name}":`,
              error
            );
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

      // Check if we already have a resource specification for this service type
      const existingResourceSpec = findResourceSpecByActionHash(
        state.resourceSpecifications,
        serviceTypeHash
      );
      if (existingResourceSpec) {
        console.log(
          'hREA Store: Resource specification already exists for service type:',
          serviceType.name
        );
        addServiceTypeResourceSpecMapping(serviceTypeHash, existingResourceSpec.id);
        return E.succeed(existingResourceSpec);
      }

      const { name, note } = createServiceTypeResourceSpecMapping(serviceType);

      return pipe(
        withInitialization(
          () => hreaService.createResourceSpecification({ name, note }),
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
      const { name, note } = createServiceTypeResourceSpecMapping(params.serviceType);

      return pipe(
        withInitialization(
          () =>
            hreaService.updateResourceSpecification({
              id: params.resourceSpecId,
              name,
              note
            }),
          state.apolloClient,
          initialize
        ),
        E.tap((updatedResourceSpec) =>
          E.sync(() => {
            if (updatedResourceSpec) {
              // Update the resource specification in the array
              const index = state.resourceSpecifications.findIndex(
                (spec) => spec.id === updatedResourceSpec.id
              );
              if (index !== -1) {
                state.resourceSpecifications[index] = updatedResourceSpec;
              }
            }
          })
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
      // Find resource specification by action hash reference
      const resourceSpec = findResourceSpecByActionHash(
        state.resourceSpecifications,
        serviceTypeHash
      );

      if (!resourceSpec) {
        console.warn(
          'hREA Store: No resource specification found for service type hash:',
          serviceTypeHash
        );
        return E.succeed(false);
      }

      return pipe(
        withInitialization(
          () => hreaService.deleteResourceSpecification({ id: resourceSpec.id }),
          state.apolloClient,
          initialize
        ),
        E.tap(() =>
          E.sync(() => {
            // Remove from mapping
            state.serviceTypeResourceSpecMappings.delete(serviceTypeHash);
            // Remove from resource specifications array
            state.resourceSpecifications = state.resourceSpecifications.filter(
              (spec) => spec.id !== resourceSpec.id
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

    const deleteAgentForOrganization = (organizationHash: string): E.Effect<boolean, HreaError> => {
      // Find agent by action hash reference
      const agent = findAgentByActionHash(state.agents, organizationHash, 'organization');

      if (!agent) {
        console.warn('hREA Store: No agent found for organization hash:', organizationHash);
        return E.succeed(false);
      }

      return pipe(
        E.sync(() => {
          // Remove from mapping
          state.organizationAgentMappings.delete(organizationHash);
          // Remove from agents array
          state.agents = state.agents.filter((a) => a.id !== agent.id);
          console.log(`hREA Store: Removed Agent "${agent.name}" for deleted organization`);
        }),
        E.map(() => true),
        E.tapError((error) =>
          E.sync(() => {
            console.error(`hREA Store: Failed to delete agent for organization:`, error);
          })
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
     * Creates mappings for existing users and organizations by finding matching agents via action hash references.
     * This handles the case where entities were created before hREA store was listening.
     */
    const createRetroactiveMappings = (
      users: UIUser[],
      organizations: UIOrganization[]
    ): E.Effect<void, HreaError> => {
      return pipe(
        withInitialization(() => hreaService.getAgents(), state.apolloClient, initialize),
        E.flatMap((agents) =>
          E.gen(function* () {
            console.log(
              `hREA Store: Starting retroactive user/org mapping - ${agents.length} agents, ${users.length} users, ${organizations.length} organizations`
            );

            // First, create mappings for existing agents by finding action hash references
            agents.forEach((agent) => {
              if (!agent.note) return;

              // Try to find user reference
              const userHash = extractActionHashFromNote(agent.note, 'user');
              if (userHash) {
                const matchingUser = users.find(
                  (user) => user.original_action_hash?.toString() === userHash
                );
                if (matchingUser) {
                  console.log(`hREA Store: Found existing user agent for "${agent.name}"`);
                  addUserAgentMapping(userHash, agent.id);
                  return;
                }
              }

              // Try to find organization reference
              const orgHash = extractActionHashFromNote(agent.note, 'organization');
              if (orgHash) {
                const matchingOrg = organizations.find(
                  (org) => org.original_action_hash?.toString() === orgHash
                );
                if (matchingOrg) {
                  console.log(`hREA Store: Found existing organization agent for "${agent.name}"`);
                  addOrganizationAgentMapping(orgHash, agent.id);
                }
              }
            });

            // Second, create missing user agents
            for (const user of users) {
              const userHash = user.original_action_hash?.toString();
              if (!userHash) continue;

              // Check if this user already has a mapping
              if (state.userAgentMappings.has(userHash)) {
                continue;
              }

              // Create a new agent for this user
              console.log(`hREA Store: Creating new agent for user "${user.name}"`);
              const newAgent = yield* createPersonFromUser(user);
              if (newAgent) {
                console.log(
                  `hREA Store: Successfully created agent "${newAgent.name}" for user "${user.name}"`
                );
              }
            }

            // Third, create missing organization agents
            for (const organization of organizations) {
              const organizationHash = organization.original_action_hash?.toString();
              if (!organizationHash) continue;

              // Check if this organization already has a mapping
              if (state.organizationAgentMappings.has(organizationHash)) {
                continue;
              }

              // Create a new agent for this organization
              console.log(`hREA Store: Creating new agent for organization "${organization.name}"`);
              const newAgent = yield* createOrganizationFromOrg(organization);
              if (newAgent) {
                console.log(
                  `hREA Store: Successfully created agent "${newAgent.name}" for organization "${organization.name}"`
                );
              }
            }

            console.log(
              `hREA Store: Retroactive user/org mapping completed - ${state.userAgentMappings.size} user mappings, ${state.organizationAgentMappings.size} organization mappings`
            );
          })
        ),
        E.asVoid,
        E.catchAll((error) => {
          console.error('hREA Store: Error in retroactive user/org mapping:', error);
          return E.void;
        }), // Don't fail the store creation if this fails
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
        E.flatMap((resourceSpecs) =>
          E.gen(function* () {
            console.log(
              `hREA Store: Starting retroactive mapping - ${resourceSpecs.length} resource specs, ${serviceTypes.length} approved service types`
            );

            // First, create mappings for existing resource specifications by finding action hash references
            resourceSpecs.forEach((resourceSpec) => {
              if (!resourceSpec.note) return;

              const serviceTypeHash = extractActionHashFromNote(resourceSpec.note, 'serviceType');
              if (serviceTypeHash) {
                const matchingServiceType = serviceTypes.find(
                  (serviceType) =>
                    serviceType.original_action_hash?.toString() === serviceTypeHash &&
                    serviceType.status === 'approved'
                );
                if (matchingServiceType) {
                  console.log(
                    `hREA Store: Found existing resource spec for "${resourceSpec.name}"`
                  );
                  addServiceTypeResourceSpecMapping(serviceTypeHash, resourceSpec.id);
                }
              }
            });

            // Second, create new resource specifications for approved service types without mappings
            const approvedServiceTypes = serviceTypes.filter(
              (serviceType) => serviceType.status === 'approved'
            );

            for (const serviceType of approvedServiceTypes) {
              const serviceTypeHash = serviceType.original_action_hash?.toString();
              if (!serviceTypeHash) continue;

              // Check if this service type already has a mapping
              if (state.serviceTypeResourceSpecMappings.has(serviceTypeHash)) {
                continue;
              }

              // Create a new resource specification for this service type
              console.log(
                `hREA Store: Creating new resource specification for service type "${serviceType.name}"`
              );
              const newResourceSpec =
                yield* createResourceSpecificationFromServiceType(serviceType);
              if (newResourceSpec) {
                console.log(
                  `hREA Store: Successfully created resource specification "${newResourceSpec.name}" for service type "${serviceType.name}"`
                );
              }
            }

            console.log(
              `hREA Store: Retroactive mapping completed - ${state.serviceTypeResourceSpecMappings.size} total mappings`
            );
          })
        ),
        E.asVoid,
        E.catchAll((error) => {
          console.error('hREA Store: Error in retroactive mapping:', error);
          return E.void;
        }), // Don't fail the store creation if this fails
        E.mapError((error) => HreaError.fromError(error, ERROR_CONTEXTS.RETROACTIVE_MAPPING))
      );
    };

    // ========================================================================
    // MANUAL SYNC METHODS (for independent updates)
    // ========================================================================

    const syncUserToAgent = (user: UIUser): E.Effect<Agent | null, HreaError> => {
      const userHash = user.original_action_hash?.toString();
      if (!userHash) {
        return E.succeed(null);
      }

      const existingAgent = findAgentByActionHash(state.agents, userHash, 'user');
      if (existingAgent) {
        // Update existing agent
        return updatePersonAgent({ agentId: existingAgent.id, user });
      } else {
        // Create new agent
        return createPersonFromUser(user);
      }
    };

    const syncOrganizationToAgent = (
      organization: UIOrganization
    ): E.Effect<Agent | null, HreaError> => {
      const orgHash = organization.original_action_hash?.toString();
      if (!orgHash) {
        return E.succeed(null);
      }

      const existingAgent = findAgentByActionHash(state.agents, orgHash, 'organization');
      if (existingAgent) {
        // Update existing agent
        return updateOrganizationAgent({ agentId: existingAgent.id, organization });
      } else {
        // Create new agent
        return createOrganizationFromOrg(organization);
      }
    };

    const syncServiceTypeToResourceSpec = (
      serviceType: UIServiceType
    ): E.Effect<ResourceSpecification | null, HreaError> => {
      const serviceTypeHash = serviceType.original_action_hash?.toString();
      if (!serviceTypeHash) {
        return E.succeed(null);
      }

      const existingResourceSpec = findResourceSpecByActionHash(
        state.resourceSpecifications,
        serviceTypeHash
      );
      if (existingResourceSpec) {
        // Update existing resource specification
        return updateResourceSpecification({
          resourceSpecId: existingResourceSpec.id,
          serviceType
        });
      } else {
        // Create new resource specification (only if approved)
        if (serviceType.status === 'approved') {
          return createResourceSpecificationFromServiceType(serviceType);
        } else {
          return E.succeed(null);
        }
      }
    };

    // ========================================================================
    // EVENT SETUP AND CLEANUP
    // ========================================================================

    const {
      handleUserCreated,
      handleOrganizationCreated,
      handleServiceTypeCreated,
      handleServiceTypeApproved,
      handleServiceTypeRejected,
      handleServiceTypeDeleted,
      handleOrganizationDeleted
    } = createEventHandlers(
      createPersonFromUser,
      createOrganizationFromOrg,
      createResourceSpecificationFromServiceType,
      deleteResourceSpecificationForServiceType,
      deleteAgentForOrganization
    );

    const { cleanup: cleanupEventSubscriptions } = createEventSubscriptions(
      handleUserCreated,
      handleOrganizationCreated,
      handleServiceTypeCreated,
      handleServiceTypeApproved,
      handleServiceTypeRejected,
      handleServiceTypeDeleted,
      handleOrganizationDeleted
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
        return state.agents;
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
      // Manual sync methods for independent updates
      syncUserToAgent,
      syncOrganizationToAgent,
      syncServiceTypeToResourceSpec,
      // Lookup methods
      findAgentByActionHash: (actionHash: string, entityType: 'user' | 'organization') =>
        findAgentByActionHash(state.agents, actionHash, entityType),
      findResourceSpecByActionHash: (actionHash: string) =>
        findResourceSpecByActionHash(state.resourceSpecifications, actionHash),
      dispose
    };
  });

// ============================================================================
// STORE INSTANCE CREATION
// ============================================================================

const hreaStore: HreaStore = pipe(
  createHreaStore(),
  E.provide(HreaServiceLive),
  E.provide(HolochainClientLive),
  E.runSync
);

export default hreaStore;
