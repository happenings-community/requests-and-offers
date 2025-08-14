/* eslint-disable @typescript-eslint/no-explicit-any */
import { HreaServiceTag, HreaServiceLive } from '$lib/services/hrea.service';
import { Effect as E, Layer, pipe } from 'effect';
import { HolochainClientLive } from '$lib/services/holochainClient.service';
import { storeEventBus } from '$lib/stores/storeEvents';
import { HreaError } from '$lib/errors';

// Import standardized store helpers
import {
  withLoadingState,
  createErrorHandler,
  createStandardEventEmitters,
  type LoadingStateSetter
} from '$lib/utils/store-helpers';
import type { Agent, ResourceSpecification, Proposal, Intent } from '$lib/types/hrea';
import type { ApolloClient } from '@apollo/client/core';
import type { UIUser, UIOrganization, UIServiceType, UIRequest, UIOffer } from '$lib/types/ui';
import type { UIMediumOfExchange } from '$lib/schemas/mediums-of-exchange.schemas';
import {
  createProposalFromRequest as mapRequestToProposal,
  validateRequestMappingRequirements,
  createProposalReference as createRequestProposalReference
} from '$lib/services/mappers/request-proposal.mapper';
import {
  createProposalFromOffer as mapOfferToProposal,
  validateOfferMappingRequirements,
  createProposalReference as createOfferProposalReference
} from '$lib/services/mappers/offer-proposal.mapper';

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
  GET_ALL_RESOURCE_SPECIFICATIONS: 'Failed to get all resource specifications',
  CREATE_MEDIUM_OF_EXCHANGE_RESOURCE_SPEC:
    'Failed to create medium of exchange resource specification',
  UPDATE_MEDIUM_OF_EXCHANGE_RESOURCE_SPEC:
    'Failed to update medium of exchange resource specification',
  DELETE_MEDIUM_OF_EXCHANGE_RESOURCE_SPEC:
    'Failed to delete medium of exchange resource specification',
  CREATE_PROPOSAL_FROM_REQUEST: 'Failed to create proposal from request',
  CREATE_PROPOSAL_FROM_OFFER: 'Failed to create proposal from offer',
  GET_ALL_PROPOSALS: 'Failed to get all proposals',
  GET_ALL_INTENTS: 'Failed to get all intents'
} as const;

// ============================================================================
// ERROR HANDLING & EVENT EMISSION
// ============================================================================

/**
 * Standardized error handler for hREA operations
 */
const handleHreaError = createErrorHandler(HreaError.fromError, 'hREA operation failed');

/**
 * Create standardized event emitters for hREA entities
 */
const agentEventEmitters = createStandardEventEmitters<Agent>('hrea-agent');
const resourceSpecEventEmitters =
  createStandardEventEmitters<ResourceSpecification>('hrea-resourceSpec');
const proposalEventEmitters = createStandardEventEmitters<Proposal>('hrea-proposal');
const intentEventEmitters = createStandardEventEmitters<Intent>('hrea-intent');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type HreaStore = {
  readonly userAgentMappings: ReadonlyMap<string, string>; // userHash -> agentId
  readonly organizationAgentMappings: ReadonlyMap<string, string>; // organizationHash -> agentId
  readonly serviceTypeResourceSpecMappings: ReadonlyMap<string, string>; // serviceTypeHash -> resourceSpecId
  readonly mediumOfExchangeResourceSpecMappings: ReadonlyMap<string, string>; // mediumOfExchangeHash -> resourceSpecId
  readonly requestProposalMappings: ReadonlyMap<string, string>; // requestHash -> proposalId
  readonly offerProposalMappings: ReadonlyMap<string, string>; // offerHash -> proposalId
  readonly agents: ReadonlyArray<Agent>;
  readonly resourceSpecifications: ReadonlyArray<ResourceSpecification>;
  readonly proposals: ReadonlyArray<Proposal>;
  readonly intents: ReadonlyArray<Intent>;
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
  readonly createResourceSpecificationFromMediumOfExchange: (
    mediumOfExchange: UIMediumOfExchange
  ) => E.Effect<ResourceSpecification | null, HreaError>;
  readonly deleteResourceSpecificationForMediumOfExchange: (
    mediumOfExchangeHash: string
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
  readonly createRetroactiveMediumOfExchangeResourceSpecMappings: (
    mediumsOfExchange: UIMediumOfExchange[]
  ) => E.Effect<void, HreaError>;
  readonly syncUserToAgent: (user: UIUser) => E.Effect<Agent | null, HreaError>;
  readonly syncOrganizationToAgent: (
    organization: UIOrganization
  ) => E.Effect<Agent | null, HreaError>;
  readonly syncServiceTypeToResourceSpec: (
    serviceType: UIServiceType
  ) => E.Effect<ResourceSpecification | null, HreaError>;
  readonly syncMediumOfExchangeToResourceSpec: (
    mediumOfExchange: UIMediumOfExchange
  ) => E.Effect<ResourceSpecification | null, HreaError>;
  readonly findAgentByActionHash: (
    actionHash: string,
    entityType: 'user' | 'organization'
  ) => Agent | null;
  readonly findResourceSpecByActionHash: (actionHash: string) => ResourceSpecification | null;
  readonly getServiceTypeResourceSpecs: () => ResourceSpecification[];
  readonly getMediumOfExchangeResourceSpecs: () => ResourceSpecification[];
  readonly createProposalFromRequest: (request: UIRequest) => E.Effect<Proposal | null, HreaError>;
  readonly createProposalFromOffer: (offer: UIOffer) => E.Effect<Proposal | null, HreaError>;
  readonly getAllProposals: () => E.Effect<void, HreaError>;
  readonly getAllIntents: () => E.Effect<void, HreaError>;
  readonly findProposalByActionHash: (
    actionHash: string,
    entityType: 'request' | 'offer'
  ) => Proposal | null;
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
 * Creates medium-of-exchange-to-resource-specification mapping data with action hash reference
 */
const createMediumOfExchangeResourceSpecMapping = (
  mediumOfExchange: UIMediumOfExchange
): { name: string; note?: string } => {
  const displayName = mediumOfExchange.name || 'Unknown Medium of Exchange';

  // Store the action hash as the primary reference
  const actionHashRef = mediumOfExchange.original_action_hash?.toString() || 'unknown';
  const note = `ref:mediumOfExchange:${actionHashRef}`;

  return { name: displayName, note };
};

/**
 * Extracts action hash from a note reference
 */
const extractActionHashFromNote = (
  note: string,
  entityType: 'user' | 'organization' | 'serviceType' | 'mediumOfExchange'
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
 * Finds an hREA proposal by original action hash reference (request or offer)
 */
const findProposalByActionHash = (
  proposals: Proposal[],
  requestProposalMappings: Map<string, string>,
  offerProposalMappings: Map<string, string>,
  actionHash: string,
  entityType: 'request' | 'offer'
): Proposal | null => {
  // Check the appropriate mapping based on entity type
  const mappings = entityType === 'request' ? requestProposalMappings : offerProposalMappings;
  const proposalId = mappings.get(actionHash);

  if (!proposalId) return null;

  return proposals.find((proposal) => proposal.id === proposalId) || null;
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
  createResourceSpecificationFromMediumOfExchange: (
    mediumOfExchange: UIMediumOfExchange
  ) => E.Effect<ResourceSpecification | null, HreaError>,
  deleteResourceSpecificationForMediumOfExchange: (
    mediumOfExchangeHash: string
  ) => E.Effect<boolean, HreaError>,
  createProposalFromRequest: (request: UIRequest) => E.Effect<Proposal | null, HreaError>,
  createProposalFromOffer: (offer: UIOffer) => E.Effect<Proposal | null, HreaError>
) => {
  const handleUserAccepted = (user: UIUser) => {
    pipe(createPersonFromUser(user), E.runPromise).catch((err) =>
      console.error('hREA Store: Failed to create person agent:', err)
    );
  };

  const handleOrganizationAccepted = (organization: UIOrganization) => {
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

  const handleMediumOfExchangeApproved = (mediumOfExchange: UIMediumOfExchange) => {
    // Only create ResourceSpecification when a Medium of Exchange is approved
    console.log(
      'hREA Store: Medium of Exchange approved, creating ResourceSpecification:',
      mediumOfExchange.name
    );
    // Create ResourceSpecification from the approved Medium of Exchange
    pipe(createResourceSpecificationFromMediumOfExchange(mediumOfExchange), E.runPromise).catch(
      (err) =>
        console.error(
          'hREA Store: Failed to create resource specification for approved medium of exchange:',
          err
        )
    );
  };

  const handleMediumOfExchangeRejected = (mediumOfExchange: UIMediumOfExchange) => {
    // When a Medium of Exchange is rejected, we delete its ResourceSpecification
    const mediumOfExchangeHash = mediumOfExchange.original_action_hash?.toString();
    if (mediumOfExchangeHash) {
      console.log(
        'hREA Store: Medium of Exchange rejected, removing ResourceSpecification:',
        mediumOfExchange.name
      );
      pipe(
        deleteResourceSpecificationForMediumOfExchange(mediumOfExchangeHash),
        E.runPromise
      ).catch((err) =>
        console.error(
          'hREA Store: Failed to delete resource specification for rejected medium of exchange:',
          err
        )
      );
    }
  };

  const handleMediumOfExchangeDeleted = (mediumOfExchangeHash: string) => {
    // When a Medium of Exchange is deleted, remove its corresponding ResourceSpecification
    console.log(
      'hREA Store: Medium of Exchange deleted, removing ResourceSpecification:',
      mediumOfExchangeHash
    );
    pipe(deleteResourceSpecificationForMediumOfExchange(mediumOfExchangeHash), E.runPromise).catch(
      (err) =>
        console.error(
          'hREA Store: Failed to delete resource specification for deleted medium of exchange:',
          err
        )
    );
  };

  const handleRequestCreated = (request: UIRequest) => {
    console.log('hREA Store: Request created, auto-creating proposal:', request.title);
    pipe(createProposalFromRequest(request), E.runPromise).catch((err) =>
      console.error('hREA Store: Failed to create proposal from request:', err)
    );
  };

  const handleOfferCreated = (offer: UIOffer) => {
    console.log('hREA Store: Offer created, auto-creating proposal:', offer.title);
    pipe(createProposalFromOffer(offer), E.runPromise).catch((err) =>
      console.error('hREA Store: Failed to create proposal from offer:', err)
    );
  };

  return {
    handleUserAccepted,
    handleOrganizationAccepted,
    handleServiceTypeCreated,
    handleServiceTypeApproved,
    handleServiceTypeRejected,
    handleServiceTypeDeleted,
    handleMediumOfExchangeApproved,
    handleMediumOfExchangeRejected,
    handleMediumOfExchangeDeleted,
    handleRequestCreated,
    handleOfferCreated
  };
};

/**
 * Creates event subscription handlers (simplified - no automatic updates)
 */
const createEventSubscriptions = (
  handleUserAccepted: (user: UIUser) => void,
  handleOrganizationAccepted: (organization: UIOrganization) => void,
  handleServiceTypeCreated: (serviceType: UIServiceType) => void,
  handleServiceTypeApproved: (serviceType: UIServiceType) => void,
  handleServiceTypeRejected: (serviceType: UIServiceType) => void,
  handleServiceTypeDeleted: (serviceTypeHash: string) => void,
  handleMediumOfExchangeApproved: (mediumOfExchange: UIMediumOfExchange) => void,
  handleMediumOfExchangeRejected: (mediumOfExchange: UIMediumOfExchange) => void,
  handleMediumOfExchangeDeleted: (mediumOfExchangeHash: string) => void,
  handleRequestCreated: (request: UIRequest) => void,
  handleOfferCreated: (offer: UIOffer) => void
) => {
  const unsubscribeFunctions: Array<() => void> = [];

  // Subscribe to acceptance events to auto-create hREA entities
  const unsubscribeUserAccepted = storeEventBus.on('user:accepted', (payload) => {
    const { user } = payload;
    handleUserAccepted(user);
  });

  const unsubscribeOrganizationAccepted = storeEventBus.on('organization:accepted', (payload) => {
    const { organization } = payload;
    handleOrganizationAccepted(organization);
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

  // Subscribe to medium of exchange events
  const unsubscribeMediumOfExchangeApproved = storeEventBus.on(
    'mediumOfExchange:approved',
    (payload) => {
      const { mediumOfExchange } = payload;
      handleMediumOfExchangeApproved(mediumOfExchange);
    }
  );

  const unsubscribeMediumOfExchangeRejected = storeEventBus.on(
    'mediumOfExchange:rejected',
    (payload) => {
      const { mediumOfExchange } = payload;
      handleMediumOfExchangeRejected(mediumOfExchange);
    }
  );

  const unsubscribeMediumOfExchangeDeleted = storeEventBus.on(
    'mediumOfExchange:deleted',
    (payload) => {
      const { mediumOfExchangeHash } = payload;
      handleMediumOfExchangeDeleted(mediumOfExchangeHash.toString());
    }
  );

  // Subscribe to request and offer creation events to auto-create proposals
  const unsubscribeRequestCreated = storeEventBus.on('request:created', (payload) => {
    const { request } = payload;
    handleRequestCreated(request);
  });

  const unsubscribeOfferCreated = storeEventBus.on('offer:created', (payload) => {
    const { offer } = payload;
    handleOfferCreated(offer);
  });

  unsubscribeFunctions.push(
    unsubscribeUserAccepted,
    unsubscribeOrganizationAccepted,
    unsubscribeServiceTypeCreated,
    unsubscribeServiceTypeApproved,
    unsubscribeServiceTypeRejected,
    unsubscribeServiceTypeDeleted,
    unsubscribeMediumOfExchangeApproved,
    unsubscribeMediumOfExchangeRejected,
    unsubscribeMediumOfExchangeDeleted,
    unsubscribeRequestCreated,
    unsubscribeOfferCreated
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

/**
 * HREA STORE - DEMONSTRATING STANDARDIZED STORE HELPER PATTERNS FOR MAPPING STORE
 *
 * This store demonstrates the use of standardized helper functions for a mapping/synchronization store:
 *
 * 1. createErrorHandler - Domain-specific error handling for hREA operations
 * 2. createStandardEventEmitters - Type-safe event emission for hREA entities (Agent, ResourceSpec, Proposal, Intent)
 * 3. withLoadingState - Consistent loading/error state management for async operations
 * 4. LoadingStateSetter - Standardized interface for loading state management
 *
 * The hREA store serves as a bridge between Holochain entities (Users, Organizations, ServiceTypes, etc.)
 * and hREA entities (Agents, ResourceSpecifications, Proposals, Intents), maintaining bidirectional mappings
 * and synchronization between the two systems.
 *
 * This store demonstrates patterns for:
 * - Entity mapping and synchronization
 * - Cross-domain event handling
 * - State consistency across multiple entity types
 * - GraphQL client integration with Effect-TS patterns
 *
 * @returns An Effect that creates an hREA store with mapping state and synchronization methods
 */
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
      mediumOfExchangeResourceSpecMappings: new Map<string, string>(), // mediumOfExchangeHash -> resourceSpecId
      requestProposalMappings: new Map<string, string>(), // requestHash -> proposalId
      offerProposalMappings: new Map<string, string>(), // offerHash -> proposalId
      agents: [] as Agent[],
      resourceSpecifications: [] as ResourceSpecification[],
      proposals: [] as Proposal[],
      intents: [] as Intent[],
      loading: false,
      error: null as HreaError | null,
      apolloClient: null as ApolloClient<any> | null,
      eventSubscriptionsActive: false
    });

    // Track in-flight operations to prevent race conditions
    const inFlightOperations = new Set<string>();

    // ========================================================================
    // HELPER INITIALIZATION WITH STANDARDIZED UTILITIES
    // ========================================================================

    // 1. LOADING STATE MANAGEMENT - Using LoadingStateSetter interface
    const setters: LoadingStateSetter = {
      setLoading: (value) => {
        state.loading = value;
      },
      setError: (value) => {
        state.error = value ? HreaError.fromError(new Error(value), 'Store operation') : null;
      }
    };

    // 2. EVENT EMITTERS - Using standardized event emitters for hREA entities
    const eventEmitters = {
      agent: agentEventEmitters,
      resourceSpec: resourceSpecEventEmitters,
      proposal: proposalEventEmitters,
      intent: intentEventEmitters
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

    const addMediumOfExchangeResourceSpecMapping = (
      mediumOfExchangeHash: string,
      resourceSpecId: string
    ) => {
      state.mediumOfExchangeResourceSpecMappings.set(mediumOfExchangeHash, resourceSpecId);
    };

    const addRequestProposalMapping = (requestHash: string, proposalId: string) => {
      state.requestProposalMappings.set(requestHash, proposalId);
    };

    const addOfferProposalMapping = (offerHash: string, proposalId: string) => {
      state.offerProposalMappings.set(offerHash, proposalId);
    };

    // ========================================================================
    // STORE METHODS
    // ========================================================================

    const initialize = (): E.Effect<void, HreaError> =>
      withLoadingState(() =>
        pipe(
          hreaService.initialize(),
          E.tap((client) =>
            E.sync(() => {
              state.apolloClient = client;
            })
          ),
          E.asVoid,
          E.mapError((error) => HreaError.fromError(error, ERROR_CONTEXTS.INITIALIZE))
        )
      )(setters);

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

    const getAllAgents = (): E.Effect<void, HreaError> =>
      withLoadingState(() =>
        pipe(
          withInitialization(() => hreaService.getAgents(), state.apolloClient, initialize),
          E.tap((fetchedAgents) =>
            E.sync(() => {
              state.agents = [...fetchedAgents];
              // Emit events for each agent
              fetchedAgents.forEach((agent) => eventEmitters.agent.emitCreated(agent));
            })
          ),
          E.mapError((error) => HreaError.fromError(error, ERROR_CONTEXTS.GET_ALL_AGENTS)),
          E.asVoid
        )
      )(setters);

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

    const createResourceSpecificationFromMediumOfExchange = (
      mediumOfExchange: UIMediumOfExchange
    ): E.Effect<ResourceSpecification | null, HreaError> => {
      const mediumOfExchangeHash = mediumOfExchange.original_action_hash?.toString();
      if (!mediumOfExchangeHash) {
        console.warn(
          'hREA Store: Cannot create resource specification for medium of exchange without action hash'
        );
        return E.succeed(null);
      }
      // Check if we already have a resource specification for this medium of exchange
      const existingResourceSpec = findResourceSpecByActionHash(
        state.resourceSpecifications,
        mediumOfExchangeHash
      );
      if (existingResourceSpec) {
        console.log(
          'hREA Store: Resource specification already exists for medium of exchange:',
          mediumOfExchange.name
        );
        addMediumOfExchangeResourceSpecMapping(mediumOfExchangeHash, existingResourceSpec.id);
        return E.succeed(existingResourceSpec);
      }
      const { name, note } = createMediumOfExchangeResourceSpecMapping(mediumOfExchange);
      return pipe(
        withInitialization(
          () => hreaService.createResourceSpecification({ name, note }),
          state.apolloClient,
          initialize
        ),
        E.tap((newResourceSpec) =>
          E.sync(() => {
            addMediumOfExchangeResourceSpecMapping(mediumOfExchangeHash, newResourceSpec.id);
            // Add the new resource specification to the list immediately
            state.resourceSpecifications = [...state.resourceSpecifications, newResourceSpec];
          })
        ),
        E.tapError((error) =>
          E.sync(() => {
            console.error(
              `hREA Store: Failed to create Resource Specification for medium of exchange "${name}":`,
              error
            );
          })
        ),
        E.mapError((error) =>
          HreaError.fromError(error, ERROR_CONTEXTS.CREATE_MEDIUM_OF_EXCHANGE_RESOURCE_SPEC)
        )
      );
    };

    const deleteResourceSpecificationForMediumOfExchange = (
      mediumOfExchangeHash: string
    ): E.Effect<boolean, HreaError> => {
      // Find resource specification by action hash reference
      const resourceSpec = findResourceSpecByActionHash(
        state.resourceSpecifications,
        mediumOfExchangeHash
      );

      if (!resourceSpec) {
        console.warn(
          'hREA Store: No resource specification found for medium of exchange hash:',
          mediumOfExchangeHash
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
            state.mediumOfExchangeResourceSpecMappings.delete(mediumOfExchangeHash);
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
              `hREA Store: Failed to delete Resource Specification for medium of exchange "${resourceSpec.name}":`,
              error
            );
          })
        ),
        E.mapError((error) =>
          HreaError.fromError(error, ERROR_CONTEXTS.DELETE_MEDIUM_OF_EXCHANGE_RESOURCE_SPEC)
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

    const getAllResourceSpecifications = (): E.Effect<void, HreaError> =>
      withLoadingState(() =>
        pipe(
          withInitialization(
            () => hreaService.getResourceSpecifications(),
            state.apolloClient,
            initialize
          ),
          E.tap((fetchedResourceSpecs) =>
            E.sync(() => {
              console.log(
                'hREA Store: Loaded resource specifications:',
                fetchedResourceSpecs.length
              );
              state.resourceSpecifications = [...fetchedResourceSpecs];
              // Emit events for each resource specification
              fetchedResourceSpecs.forEach((spec) => eventEmitters.resourceSpec.emitCreated(spec));
            })
          ),
          E.mapError((error) =>
            HreaError.fromError(error, ERROR_CONTEXTS.GET_ALL_RESOURCE_SPECIFICATIONS)
          ),
          E.asVoid
        )
      )(setters);

    const getAllProposals = (): E.Effect<void, HreaError> => {
      return pipe(
        E.sync(() => setters.setLoading(true)),
        E.flatMap(() =>
          withInitialization(() => hreaService.getProposals(), state.apolloClient, initialize)
        ),
        E.tap((fetchedProposals) =>
          E.sync(() => {
            console.log('hREA Store: Loaded proposals:', fetchedProposals.length);
            state.proposals = [...fetchedProposals];
            setters.setLoading(false);
          })
        ),
        E.tapError((error) =>
          E.sync(() => {
            console.error('hREA Store: Failed to load proposals:', error);
            setters.setError(String(HreaError.fromError(error, ERROR_CONTEXTS.GET_ALL_PROPOSALS)));
            setters.setLoading(false);
          })
        ),
        E.asVoid
      );
    };

    const getAllIntents = (): E.Effect<void, HreaError> => {
      return pipe(
        E.sync(() => setters.setLoading(true)),
        E.flatMap(() =>
          withInitialization(() => hreaService.getIntents(), state.apolloClient, initialize)
        ),
        E.tap((fetchedIntents) =>
          E.sync(() => {
            console.log('hREA Store: Loaded intents:', fetchedIntents.length);
            state.intents = [...fetchedIntents];
            setters.setLoading(false);
          })
        ),
        E.tapError((error) =>
          E.sync(() => {
            console.error('hREA Store: Failed to load intents:', error);
            setters.setError(String(HreaError.fromError(error, ERROR_CONTEXTS.GET_ALL_INTENTS)));
            setters.setLoading(false);
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

    const createRetroactiveMediumOfExchangeResourceSpecMappings = (
      mediumsOfExchange: UIMediumOfExchange[]
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
              `hREA Store: Starting retroactive medium of exchange mapping - ${resourceSpecs.length} resource specs, ${mediumsOfExchange.length} approved mediums of exchange`
            );
            // First, create mappings for existing resource specifications by finding action hash references
            resourceSpecs.forEach((resourceSpec) => {
              if (!resourceSpec.note) return;
              const mediumOfExchangeHash = extractActionHashFromNote(
                resourceSpec.note,
                'mediumOfExchange'
              );
              if (mediumOfExchangeHash) {
                const matchingMediumOfExchange = mediumsOfExchange.find(
                  (mediumOfExchange) =>
                    mediumOfExchange.original_action_hash?.toString() === mediumOfExchangeHash &&
                    mediumOfExchange.status === 'approved'
                );
                if (matchingMediumOfExchange) {
                  console.log(
                    `hREA Store: Found existing resource spec for medium of exchange "${resourceSpec.name}"`
                  );
                  addMediumOfExchangeResourceSpecMapping(mediumOfExchangeHash, resourceSpec.id);
                }
              }
            });
            // Second, create new resource specifications for approved mediums of exchange without mappings
            for (const mediumOfExchange of mediumsOfExchange) {
              const mediumOfExchangeHash = mediumOfExchange.original_action_hash?.toString();
              if (
                mediumOfExchange.status === 'approved' &&
                mediumOfExchangeHash &&
                !state.mediumOfExchangeResourceSpecMappings.has(mediumOfExchangeHash)
              ) {
                // Create a new resource specification for this medium of exchange
                console.log(
                  `hREA Store: Creating new resource specification for medium of exchange "${mediumOfExchange.name}"`
                );
                const newResourceSpec =
                  yield* createResourceSpecificationFromMediumOfExchange(mediumOfExchange);
                if (newResourceSpec) {
                  console.log(
                    `hREA Store: Successfully created resource specification "${newResourceSpec.name}" for medium of exchange "${mediumOfExchange.name}"`
                  );
                }
              }
            }
            console.log(
              `hREA Store: Retroactive medium of exchange mapping completed - ${state.mediumOfExchangeResourceSpecMappings.size} total mappings`
            );
          })
        ),
        E.asVoid,
        E.catchAll((error) => {
          console.error('hREA Store: Error in retroactive medium of exchange mapping:', error);
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

    const syncMediumOfExchangeToResourceSpec = (
      mediumOfExchange: UIMediumOfExchange
    ): E.Effect<ResourceSpecification | null, HreaError> => {
      const mediumOfExchangeHash = mediumOfExchange.original_action_hash?.toString();
      if (!mediumOfExchangeHash) {
        return E.succeed(null);
      }
      const existingResourceSpec = findResourceSpecByActionHash(
        state.resourceSpecifications,
        mediumOfExchangeHash
      );
      if (existingResourceSpec) {
        // For now, we don't have an update method specifically for medium of exchange
        // We could add updateResourceSpecificationFromMediumOfExchange if needed
        console.log(
          'hREA Store: Found existing resource spec for medium of exchange, skipping update:',
          mediumOfExchange.name
        );
        return E.succeed(existingResourceSpec);
      } else {
        // Create new resource specification (only if approved)
        if (mediumOfExchange.status === 'approved') {
          return createResourceSpecificationFromMediumOfExchange(mediumOfExchange);
        } else {
          return E.succeed(null);
        }
      }
    };

    // ========================================================================
    // PROPOSAL CREATION METHODS
    // ========================================================================

    const createProposalFromRequest = (
      request: UIRequest
    ): E.Effect<Proposal | null, HreaError> => {
      const requestHash = request.original_action_hash?.toString();

      if (!requestHash) {
        console.warn('hREA Store: Cannot create proposal for request without action hash');
        return E.succeed(null);
      }

      // Check if we already have a proposal for this request
      const existingProposalId = state.requestProposalMappings.get(requestHash);
      if (existingProposalId) {
        const existingProposal = state.proposals.find((p) => p.id === existingProposalId);
        if (existingProposal) {
          console.log('hREA Store: Proposal already exists for request:', request.title);
          return E.succeed(existingProposal);
        }
      }

      return pipe(
        E.gen(function* () {
          // 1. Find the requester agent by action hash reference
          const creatorHash = request.creator?.toString();
          const requesterAgent = creatorHash
            ? findAgentByActionHash(state.agents, creatorHash, 'user')
            : null;

          if (!requesterAgent) {
            console.error('hREA Store: Requester agent not found for request:', request.title);
            return null;
          }

          // 2. Find service type resource specifications
          const serviceTypeResourceSpecs: ResourceSpecification[] = [];
          if (request.service_type_hashes) {
            for (const serviceTypeHash of request.service_type_hashes) {
              const resourceSpec = findResourceSpecByActionHash(
                state.resourceSpecifications,
                serviceTypeHash.toString()
              );
              if (resourceSpec) {
                serviceTypeResourceSpecs.push(resourceSpec);
              }
            }
          }

          // 3. Find medium of exchange resource specification
          let mediumOfExchangeResourceSpec: ResourceSpecification | null = null;
          if (request.medium_of_exchange_hashes && request.medium_of_exchange_hashes.length > 0) {
            const mediumOfExchangeHash = request.medium_of_exchange_hashes[0].toString();
            mediumOfExchangeResourceSpec =
              state.resourceSpecifications.find((spec) =>
                spec.note?.includes(`ref:mediumOfExchange:${mediumOfExchangeHash}`)
              ) || null;
          }

          // 4. Validate requirements
          yield* validateRequestMappingRequirements(
            request,
            requesterAgent,
            serviceTypeResourceSpecs,
            mediumOfExchangeResourceSpec
          );

          // 5. Create proposal and intents using mapper
          const mappingResult = yield* mapRequestToProposal({
            request,
            requesterAgent,
            serviceTypeResourceSpecs,
            mediumOfExchangeResourceSpec: mediumOfExchangeResourceSpec!
          });

          // 6. Create intents first
          const createdIntents: Intent[] = [];
          for (const intentData of mappingResult.allIntents) {
            const createdIntent = yield* withInitialization(
              () =>
                hreaService.createIntent({
                  action: intentData.action,
                  provider: intentData.provider,
                  receiver: intentData.receiver,
                  resourceSpecifiedBy: intentData.resourceSpecifiedBy,
                  resourceQuantity: intentData.resourceQuantity
                }),
              state.apolloClient,
              initialize
            );

            createdIntents.push(createdIntent);
          }

          // 7. Create proposal with intent IDs in publishes field
          const createdProposal = yield* withInitialization(
            () =>
              hreaService.createProposal({
                name: mappingResult.proposal.name,
                note: mappingResult.proposal.note,
                publishes: createdIntents.map((intent) => intent.id)
              }),
            state.apolloClient,
            initialize
          );

          // 8. Update state
          state.proposals = [...state.proposals, createdProposal];
          state.intents = [...state.intents, ...createdIntents];
          addRequestProposalMapping(requestHash, createdProposal.id);

          console.log(
            `hREA Store: Created proposal "${createdProposal.name}" with ${createdIntents.length} intents`
          );
          return createdProposal;
        }),
        E.tapError((error) =>
          E.sync(() => {
            console.error('hREA Store: Failed to create proposal from request:', error);
            setters.setError(
              String(HreaError.fromError(error, ERROR_CONTEXTS.CREATE_PROPOSAL_FROM_REQUEST))
            );
          })
        )
      );
    };

    const createProposalFromOffer = (offer: UIOffer): E.Effect<Proposal | null, HreaError> => {
      const offerHash = offer.original_action_hash?.toString();

      if (!offerHash) {
        console.warn('hREA Store: Cannot create proposal for offer without action hash');
        return E.succeed(null);
      }

      // Check if we already have a proposal for this offer
      const existingProposalId = state.offerProposalMappings.get(offerHash);
      if (existingProposalId) {
        const existingProposal = state.proposals.find((p) => p.id === existingProposalId);
        if (existingProposal) {
          console.log('hREA Store: Proposal already exists for offer:', offer.title);
          return E.succeed(existingProposal);
        }
      }

      return pipe(
        E.gen(function* () {
          // 1. Find the offerer agent by action hash reference
          const creatorHash = offer.creator?.toString();
          const offererAgent = creatorHash
            ? findAgentByActionHash(state.agents, creatorHash, 'user')
            : null;

          if (!offererAgent) {
            console.error('hREA Store: Offerer agent not found for offer:', offer.title);
            return null;
          }

          // 2. Find service type resource specifications
          const serviceTypeResourceSpecs: ResourceSpecification[] = [];
          if (offer.service_type_hashes) {
            for (const serviceTypeHash of offer.service_type_hashes) {
              const resourceSpec = findResourceSpecByActionHash(
                state.resourceSpecifications,
                serviceTypeHash.toString()
              );
              if (resourceSpec) {
                serviceTypeResourceSpecs.push(resourceSpec);
              }
            }
          }

          // 3. Find medium of exchange resource specification
          let mediumOfExchangeResourceSpec: ResourceSpecification | null = null;
          if (offer.medium_of_exchange_hashes && offer.medium_of_exchange_hashes.length > 0) {
            const mediumOfExchangeHash = offer.medium_of_exchange_hashes[0].toString();
            mediumOfExchangeResourceSpec =
              state.resourceSpecifications.find((spec) =>
                spec.note?.includes(`ref:mediumOfExchange:${mediumOfExchangeHash}`)
              ) || null;
          }

          // 4. Validate requirements
          yield* validateOfferMappingRequirements(
            offer,
            offererAgent,
            serviceTypeResourceSpecs,
            mediumOfExchangeResourceSpec
          );

          // 5. Create proposal and intents using mapper
          const mappingResult = yield* mapOfferToProposal({
            offer,
            offererAgent,
            serviceTypeResourceSpecs,
            mediumOfExchangeResourceSpec: mediumOfExchangeResourceSpec!
          });

          // 6. Create intents first
          const createdIntents: Intent[] = [];
          for (const intentData of mappingResult.allIntents) {
            const createdIntent = yield* withInitialization(
              () =>
                hreaService.createIntent({
                  action: intentData.action,
                  provider: intentData.provider,
                  receiver: intentData.receiver,
                  resourceSpecifiedBy: intentData.resourceSpecifiedBy,
                  resourceQuantity: intentData.resourceQuantity
                }),
              state.apolloClient,
              initialize
            );

            createdIntents.push(createdIntent);
          }

          // 7. Create proposal with intent IDs in publishes field
          const createdProposal = yield* withInitialization(
            () =>
              hreaService.createProposal({
                name: mappingResult.proposal.name,
                note: mappingResult.proposal.note,
                publishes: createdIntents.map((intent) => intent.id)
              }),
            state.apolloClient,
            initialize
          );

          // 8. Update state
          state.proposals = [...state.proposals, createdProposal];
          state.intents = [...state.intents, ...createdIntents];
          addOfferProposalMapping(offerHash, createdProposal.id);

          console.log(
            `hREA Store: Created proposal "${createdProposal.name}" with ${createdIntents.length} intents`
          );
          return createdProposal;
        }),
        E.tapError((error) =>
          E.sync(() => {
            console.error('hREA Store: Failed to create proposal from offer:', error);
            setters.setError(
              String(HreaError.fromError(error, ERROR_CONTEXTS.CREATE_PROPOSAL_FROM_OFFER))
            );
          })
        )
      );
    };

    // ========================================================================
    // EVENT SETUP AND CLEANUP
    // ========================================================================

    const {
      handleUserAccepted,
      handleOrganizationAccepted,
      handleServiceTypeCreated,
      handleServiceTypeApproved,
      handleServiceTypeRejected,
      handleServiceTypeDeleted,
      handleMediumOfExchangeApproved,
      handleMediumOfExchangeRejected,
      handleMediumOfExchangeDeleted,
      handleRequestCreated,
      handleOfferCreated
    } = createEventHandlers(
      createPersonFromUser,
      createOrganizationFromOrg,
      createResourceSpecificationFromServiceType,
      deleteResourceSpecificationForServiceType,
      createResourceSpecificationFromMediumOfExchange,
      deleteResourceSpecificationForMediumOfExchange,
      createProposalFromRequest,
      createProposalFromOffer
    );

    const { cleanup: cleanupEventSubscriptions } = createEventSubscriptions(
      handleUserAccepted,
      handleOrganizationAccepted,
      handleServiceTypeCreated,
      handleServiceTypeApproved,
      handleServiceTypeRejected,
      handleServiceTypeDeleted,
      handleMediumOfExchangeApproved,
      handleMediumOfExchangeRejected,
      handleMediumOfExchangeDeleted,
      handleRequestCreated,
      handleOfferCreated
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
      get mediumOfExchangeResourceSpecMappings() {
        return state.mediumOfExchangeResourceSpecMappings;
      },
      get requestProposalMappings() {
        return state.requestProposalMappings;
      },
      get offerProposalMappings() {
        return state.offerProposalMappings;
      },
      get agents() {
        return state.agents;
      },
      get resourceSpecifications() {
        return state.resourceSpecifications;
      },
      get proposals() {
        return state.proposals;
      },
      get intents() {
        return state.intents;
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
      createResourceSpecificationFromMediumOfExchange,
      deleteResourceSpecificationForMediumOfExchange,
      getAllAgents,
      getAllResourceSpecifications,
      getAllProposals,
      getAllIntents,
      createRetroactiveMappings,
      createRetroactiveResourceSpecMappings,
      createRetroactiveMediumOfExchangeResourceSpecMappings,
      createProposalFromRequest,
      createProposalFromOffer,
      // Manual sync methods for independent updates
      syncUserToAgent,
      syncOrganizationToAgent,
      syncServiceTypeToResourceSpec,
      syncMediumOfExchangeToResourceSpec,
      // Lookup methods
      findAgentByActionHash: (actionHash: string, entityType: 'user' | 'organization') =>
        findAgentByActionHash(state.agents, actionHash, entityType),
      findResourceSpecByActionHash: (actionHash: string) =>
        findResourceSpecByActionHash(state.resourceSpecifications, actionHash),
      findProposalByActionHash: (actionHash: string, entityType: 'request' | 'offer') =>
        findProposalByActionHash(
          state.proposals,
          state.requestProposalMappings,
          state.offerProposalMappings,
          actionHash,
          entityType
        ),
      getServiceTypeResourceSpecs: () =>
        state.resourceSpecifications.filter((spec) => spec.note?.startsWith('ref:serviceType:')),
      getMediumOfExchangeResourceSpecs: () =>
        state.resourceSpecifications.filter((spec) =>
          spec.note?.startsWith('ref:mediumOfExchange:')
        ),
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
