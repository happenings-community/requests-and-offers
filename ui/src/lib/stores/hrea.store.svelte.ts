/* eslint-disable @typescript-eslint/no-explicit-any */
import { HreaServiceTag, HreaServiceLive } from '$lib/services/zomes/hrea.service';
import { Effect as E, Layer, pipe } from 'effect';
import { HolochainClientLive } from '$lib/services/holochainClient.service';
import { storeEventBus } from '$lib/stores/storeEvents';
import { HreaError } from '$lib/errors';
import type { Agent } from '$lib/types/hrea';
import type { ApolloClient } from '@apollo/client/core';
import type { UIUser } from '$lib/types/ui';

// ============================================================================
// CONSTANTS
// ============================================================================

const ERROR_CONTEXTS = {
  INITIALIZE: 'Failed to initialize hREA service',
  CREATE_PERSON: 'Failed to create person agent',
  UPDATE_PERSON: 'Failed to update person agent',
  GET_ALL_AGENTS: 'Failed to get all agents',
  RETROACTIVE_MAPPING: 'Failed to create retroactive mappings'
} as const;

const DEBOUNCE_DELAY_MS = 300;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type HreaStore = {
  readonly userAgentMappings: ReadonlyMap<string, string>; // userHash -> agentId
  readonly agents: ReadonlyArray<Agent>;
  readonly loading: boolean;
  readonly error: HreaError | null;
  readonly apolloClient: ApolloClient<any> | null;
  readonly initialize: () => E.Effect<void, HreaError>;
  readonly createPersonFromUser: (user: UIUser) => E.Effect<Agent | null, HreaError>;
  readonly updatePersonAgent: (params: {
    agentId: string;
    user: UIUser;
  }) => E.Effect<Agent | null, HreaError>;
  readonly getAllAgents: () => E.Effect<void, HreaError>;
  readonly createRetroactiveMappings: (users: UIUser[]) => E.Effect<void, HreaError>;
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
 * Creates debounced operation handlers
 */
const createDebouncedHandlers = (
  debounceTimeouts: Map<string, NodeJS.Timeout>,
  createPersonFromUser: (user: UIUser) => E.Effect<Agent | null, HreaError>,
  updatePersonAgent: (params: {
    agentId: string;
    user: UIUser;
  }) => E.Effect<Agent | null, HreaError>,
  userAgentMappings: Map<string, string>
) => {
  const debouncedCreatePersonFromUser = (user: UIUser, delay: number = DEBOUNCE_DELAY_MS) => {
    const userHash = user.original_action_hash?.toString();
    if (!userHash) return;

    // Clear existing timeout for this user
    const existingTimeout = debounceTimeouts.get(userHash);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeoutId = setTimeout(() => {
      pipe(createPersonFromUser(user), E.runPromise).catch((err) =>
        console.error('hREA Store: Failed to create person agent (debounced):', err)
      );
      debounceTimeouts.delete(userHash);
    }, delay);

    debounceTimeouts.set(userHash, timeoutId);
  };

  const debouncedUpdatePersonAgent = (user: UIUser, delay: number = DEBOUNCE_DELAY_MS) => {
    const userHash = user.original_action_hash?.toString();
    if (!userHash) return;

    const agentId = userAgentMappings.get(userHash);
    if (!agentId) return;

    // Clear existing timeout for this user update
    const updateKey = `update-${userHash}`;
    const existingTimeout = debounceTimeouts.get(updateKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeoutId = setTimeout(() => {
      pipe(updatePersonAgent({ agentId, user }), E.runPromise).catch((err) =>
        console.error('hREA Store: Failed to update person agent (debounced):', err)
      );
      debounceTimeouts.delete(updateKey);
    }, delay);

    debounceTimeouts.set(updateKey, timeoutId);
  };

  return {
    debouncedCreatePersonFromUser,
    debouncedUpdatePersonAgent
  };
};

/**
 * Creates event subscription handlers
 */
const createEventSubscriptions = (
  debouncedCreatePersonFromUser: (user: UIUser, delay?: number) => void,
  debouncedUpdatePersonAgent: (user: UIUser, delay?: number) => void,
  userAgentMappings: Map<string, string>
) => {
  const unsubscribeFunctions: Array<() => void> = [];

  // Subscribe to user creation events to auto-create person agents
  const unsubscribeUserCreated = storeEventBus.on('user:created', (payload) => {
    const { user } = payload;
    debouncedCreatePersonFromUser(user);
  });

  // Subscribe to user update events for agent synchronization
  const unsubscribeUserUpdated = storeEventBus.on('user:updated', (payload) => {
    const { user } = payload;
    const userHash = user.original_action_hash?.toString();

    if (userHash && userAgentMappings.has(userHash)) {
      // Use debounced update to prevent race conditions
      debouncedUpdatePersonAgent(user);
    } else if (userHash) {
      // Use debounced creation for users without agents
      debouncedCreatePersonFromUser(user);
    }
  });

  unsubscribeFunctions.push(unsubscribeUserCreated, unsubscribeUserUpdated);

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
      agents: [] as Agent[],
      loading: false,
      error: null as HreaError | null,
      apolloClient: null as ApolloClient<any> | null,
      eventSubscriptionsActive: false
    });

    // Track in-flight operations to prevent race conditions
    const inFlightOperations = new Set<string>();

    // Debounce map to prevent rapid-fire events
    const debounceTimeouts = new Map<string, NodeJS.Timeout>();

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

    /**
     * Creates mappings for existing users who have agents but no mappings.
     * This handles the case where users were created before hREA store was listening.
     * NOTE: This is a temporary solution based on name matching. The long-term plan
     * is to store agentId directly on User entries in the users_organizations zome.
     */
    const createRetroactiveMappings = (users: UIUser[]): E.Effect<void, HreaError> => {
      return pipe(
        withInitialization(() => hreaService.getAgents(), state.apolloClient, initialize),
        E.tap((agents) =>
          E.sync(() => {
            agents.forEach((agent) => {
              const existingMapping = Array.from(state.userAgentMappings.entries()).find(
                ([_, agentId]) => agentId === agent.id
              );

              if (existingMapping) {
                return;
              }

              // Try to find matching user by name (temporary solution)
              const matchingUser = users.find((user) => {
                return user.name === agent.name || user.nickname === agent.name;
              });

              if (matchingUser && matchingUser.original_action_hash) {
                const userHash = matchingUser.original_action_hash.toString();
                addUserAgentMapping(userHash, agent.id);
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

    const { debouncedCreatePersonFromUser, debouncedUpdatePersonAgent } = createDebouncedHandlers(
      debounceTimeouts,
      createPersonFromUser,
      updatePersonAgent,
      state.userAgentMappings
    );

    const { cleanup: cleanupEventSubscriptions } = createEventSubscriptions(
      debouncedCreatePersonFromUser,
      debouncedUpdatePersonAgent,
      state.userAgentMappings
    );

    const dispose = () => {
      // Clear all pending debounce timeouts
      debounceTimeouts.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      debounceTimeouts.clear();

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
      get agents() {
        return state.agents; // Simplified - no longer injects mappings
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
      getAllAgents,
      createRetroactiveMappings,
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
