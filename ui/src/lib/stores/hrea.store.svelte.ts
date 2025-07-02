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
  UPDATE_PERSON: 'Failed to update person agent'
} as const;

// ============================================================================
// ERROR HANDLING
// ============================================================================

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
    user: any;
  }) => E.Effect<Agent | null, HreaError>;
  readonly getAllAgents: () => E.Effect<void, HreaError>;
  readonly createRetroactiveMappings: (users: any[]) => E.Effect<void, HreaError>;
  // For debugging/visualisation
  readonly dispose: () => void;
};

// ============================================================================
// STORE FACTORY
// ============================================================================

export const createHreaStore = (): E.Effect<HreaStore, never, HreaServiceTag> =>
  E.gen(function* () {
    const hreaService = yield* HreaServiceTag;

    // Capture the store ID for this specific store instance
    const storeInstanceId = _currentStoreId || generateStoreId();

    const state = $state({
      userAgentMappings: new Map<string, string>(), // userHash -> agentId
      agents: [] as Agent[],
      loading: false,
      error: null as HreaError | null,
      apolloClient: null as ApolloClient<any> | null,
      initialized: false, // Add initialization flag
      eventSubscriptionsActive: false // Track if this instance has active subscriptions
    });

    const unsubscribeFunctions: Array<() => void> = [];

    // Track in-flight operations to prevent race conditions
    const inFlightOperations = new Set<string>();

    // Debounce map to prevent rapid-fire events
    const debounceTimeouts = new Map<string, NodeJS.Timeout>();

    const setLoading = (loading: boolean) => {
      state.loading = loading;
    };

    const setError = (error: HreaError | null) => {
      state.error = error;
    };

    const addUserAgentMapping = (userHash: string, agentId: string) => {
      state.userAgentMappings.set(userHash, agentId);
    };

    /**
     * Enhanced user-to-agent mapping logic
     */
    const createUserAgentMapping = (user: any): { name: string; note: string } => {
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

    const createPersonFromUser = (user: any): E.Effect<Agent | null, HreaError> => {
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
        E.void,
        // Ensure initialization before attempting to create person
        E.flatMap(() => {
          if (!state.apolloClient) {
            return initialize();
          }
          return E.void;
        }),
        E.flatMap(() => hreaService.createPerson({ name, note })),
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
        E.mapError((error) => HreaError.fromError(error, 'Failed to create person from user'))
      );
    };

    const updatePersonAgent = (params: {
      agentId: string;
      user: any;
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
        E.void,
        // Ensure initialization before attempting to update person
        E.flatMap(() => {
          if (!state.apolloClient) {
            return initialize();
          }
          return E.void;
        }),
        E.flatMap(() =>
          hreaService.updatePerson({
            id: params.agentId,
            name,
            note
          })
        ),
        E.tap((updatedAgent) => E.sync(() => {})),
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
        E.mapError((error) => HreaError.fromError(error, 'Failed to update person agent'))
      );
    };

    const getAllAgents = (): E.Effect<void, HreaError> => {
      return pipe(
        E.sync(() => setLoading(true)),
        // Ensure initialization before attempting to get agents
        E.flatMap(() => {
          if (!state.apolloClient) {
            return initialize();
          }
          return E.void;
        }),
        E.flatMap(() => hreaService.getAgents()),
        E.tap((fetchedAgents) =>
          E.sync(() => {
            state.agents = [...fetchedAgents];
            setLoading(false);
          })
        ),
        E.tapError((error) =>
          E.sync(() => {
            setError(HreaError.fromError(error, 'Failed to get all agents'));
            setLoading(false);
          })
        ),
        E.asVoid
      );
    };

    /**
     * Debounced event handler to prevent rapid-fire events
     */
    const debouncedCreatePersonFromUser = (user: any, delay: number = 500) => {
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

    /**
     * Debounced update handler
     */
    const debouncedUpdatePersonAgent = (user: any, delay: number = 500) => {
      const userHash = user.original_action_hash?.toString();
      if (!userHash) return;

      const agentId = state.userAgentMappings.get(userHash);
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

    const setupEventSubscriptions = (): void => {
      // Only set up event subscriptions once per store instance
      if (state.eventSubscriptionsActive) {
        return;
      }

      // Subscribe to user creation events to auto-create person agents
      const unsubscribeUserCreated = storeEventBus.on('user:created', (payload) => {
        const { user } = payload;

        // Use debounced creation to prevent race conditions
        debouncedCreatePersonFromUser(user, 300);
      });

      // Subscribe to user update events for agent synchronization
      const unsubscribeUserUpdated = storeEventBus.on('user:updated', (payload) => {
        const { user } = payload;
        const userHash = user.original_action_hash?.toString();

        if (userHash && state.userAgentMappings.has(userHash)) {
          // Use debounced update to prevent race conditions
          debouncedUpdatePersonAgent(user, 300);
        } else if (userHash) {
          // Use debounced creation for users without agents
          debouncedCreatePersonFromUser(user, 300);
        }
      });

      unsubscribeFunctions.push(unsubscribeUserCreated, unsubscribeUserUpdated);
      state.initialized = true;
      state.eventSubscriptionsActive = true;
    };

    // Set up event subscriptions
    setupEventSubscriptions();

    const dispose = () => {
      // Clear all pending debounce timeouts
      debounceTimeouts.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      debounceTimeouts.clear();

      // Clear in-flight operations
      inFlightOperations.clear();

      // Unsubscribe from all events
      unsubscribeFunctions.forEach((unsubscribe) => {
        unsubscribe();
      });

      // Reset initialization state
      state.initialized = false;
      state.eventSubscriptionsActive = false;
    };

    const initialize = (): E.Effect<void, HreaError> => {
      setLoading(true);

      return pipe(
        hreaService.initialize(),
        E.tap((client) =>
          E.sync(() => {
            state.apolloClient = client;
          })
        ),
        E.tap(() => {
          // Event subscriptions are already set up during store creation
        }),
        E.asVoid,
        E.ensuring(E.sync(() => setLoading(false)))
      );
    };

    /**
     * Creates mappings for existing users who have agents but no mappings
     * This handles the case where users were created before hREA store was listening
     */
    const createRetroactiveMappings = (users: any[]): E.Effect<void, HreaError> => {
      return pipe(
        // Start with a void effect and ensure initialization
        E.void,
        E.flatMap(() => {
          if (!state.apolloClient) {
            return initialize();
          }
          return E.void;
        }),
        // First get all existing agents
        E.flatMap(() => hreaService.getAgents()),
        E.tap((agents) =>
          E.sync(() => {
            agents.forEach((agent) => {
              const existingMapping = Array.from(state.userAgentMappings.entries()).find(
                ([_, agentId]) => agentId === agent.id
              );

              if (existingMapping) {
                return;
              }

              // Try to find matching user by name
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
        E.catchAll((error) => {
          return E.void; // Don't fail the store creation if this fails
        })
      );
    };

    return {
      get userAgentMappings() {
        return state.userAgentMappings;
      },
      get agents() {
        return state.agents.map((agent) => ({
          ...agent,
          userAgentMappings: state.userAgentMappings
        }));
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
// SVELTE STORE SINGLETON
// ============================================================================

const hreaStoreLayer = Layer.provide(HreaServiceLive, HolochainClientLive);

// Generate unique store instance ID
const generateStoreId = () => Math.random().toString(36).substr(2, 9);

let _hreaStore: HreaStore | null = null;
let _isInitializing = false;
let _initializationPromise: Promise<HreaStore> | null = null;
let _currentStoreId: string | null = null;

const getHreaStore = (): HreaStore => {
  // If store already exists, return it immediately
  if (_hreaStore) {
    return _hreaStore;
  }

  // If currently initializing, this should not happen in sync context
  // but we'll handle it defensively
  if (_isInitializing) {
    throw new Error(
      'hREA Store is currently being initialized - this should not happen in sync context'
    );
  }

  // Mark as initializing to prevent concurrent initialization
  _isInitializing = true;
  _currentStoreId = generateStoreId();

  try {
    const storeEffect = pipe(createHreaStore(), E.provide(hreaStoreLayer));
    _hreaStore = E.runSync(storeEffect);
    return _hreaStore;
  } finally {
    _isInitializing = false;
  }
};

// Reset function for testing/development
const resetHreaStore = () => {
  if (_hreaStore && typeof _hreaStore.dispose === 'function') {
    _hreaStore.dispose();
  }
  _hreaStore = null;
  _isInitializing = false;
  _initializationPromise = null;
  _currentStoreId = null;
};

const hreaStore = new Proxy({} as HreaStore, {
  get(target, prop) {
    // Special handling for reset function (for development/testing)
    if (prop === '_reset') {
      return resetHreaStore;
    }

    const store = getHreaStore();
    const value = store[prop as keyof HreaStore];
    const result = typeof value === 'function' ? value.bind(store) : value;

    return result;
  }
});

export default hreaStore;
