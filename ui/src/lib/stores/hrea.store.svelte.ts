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
    console.log(`hREA Store: Creating store instance with ID: ${storeInstanceId}`);

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
      console.log(
        `hREA Store: Added mapping ${userHash} -> ${agentId} (Store instance: ${storeInstanceId})`
      );
      console.log(
        `hREA Store: Current mappings size after add: ${state.userAgentMappings.size} (Store instance: ${storeInstanceId})`
      );
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
        console.log(`hREA Store: Agent creation already in progress for user ${userHash}`);
        return E.succeed(null);
      }

      // Check if we already have a mapping for this user
      if (state.userAgentMappings.has(userHash)) {
        console.log(`hREA Store: Agent already exists for user ${userHash}`);
        return E.succeed(null);
      }

      const { name, note } = createUserAgentMapping(user);

      console.log(`hREA Store: Creating Person Agent for user "${name}" (${userHash})`);

      // Mark operation as in-flight
      inFlightOperations.add(userHash);

      return pipe(
        E.void,
        // Ensure initialization before attempting to create person
        E.flatMap(() => {
          if (!state.apolloClient) {
            console.log(`hREA Store: Auto-initializing before createPersonFromUser call`);
            return initialize();
          }
          return E.void;
        }),
        E.flatMap(() => hreaService.createPerson({ name, note })),
        E.tap((newAgent) =>
          E.sync(() => {
            addUserAgentMapping(userHash, newAgent.id);
            console.log(
              `hREA Store: Successfully created Person Agent "${newAgent.id}" for user "${name}"`
            );
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
        console.log(`hREA Store: Agent update already in progress for user ${userHash}`);
        return E.succeed(null);
      }

      const { name, note } = createUserAgentMapping(params.user);

      console.log(`hREA Store: Updating Person Agent "${params.agentId}" for user "${name}"`);

      // Mark operation as in-flight
      inFlightOperations.add(`update-${userHash}`);

      return pipe(
        E.void,
        // Ensure initialization before attempting to update person
        E.flatMap(() => {
          if (!state.apolloClient) {
            console.log(`hREA Store: Auto-initializing before updatePersonAgent call`);
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
        E.tap((updatedAgent) =>
          E.sync(() => {
            console.log(
              `hREA Store: Successfully updated Person Agent "${updatedAgent.id}" for user "${name}"`
            );
          })
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
        E.mapError((error) => HreaError.fromError(error, 'Failed to update person agent'))
      );
    };

    const getAllAgents = (): E.Effect<void, HreaError> => {
      return pipe(
        E.sync(() => setLoading(true)),
        // Ensure initialization before attempting to get agents
        E.flatMap(() => {
          if (!state.apolloClient) {
            console.log(`hREA Store: Auto-initializing before getAllAgents call`);
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
        console.log(
          `hREA Store: Event subscriptions already set up for instance ${storeInstanceId}, skipping`
        );
        return;
      }

      console.log(`hREA Store: Setting up event subscriptions for instance ${storeInstanceId}`);

      // Subscribe to user creation events to auto-create person agents
      const unsubscribeUserCreated = storeEventBus.on('user:created', (payload) => {
        const { user } = payload;
        console.log(
          `hREA Store: Instance ${storeInstanceId} received user:created event for user:`,
          user.name || user.nickname
        );

        // Use debounced creation to prevent race conditions
        debouncedCreatePersonFromUser(user, 300);
      });

      // Subscribe to user update events for agent synchronization
      const unsubscribeUserUpdated = storeEventBus.on('user:updated', (payload) => {
        const { user } = payload;
        const userHash = user.original_action_hash?.toString();

        console.log(
          `hREA Store: Instance ${storeInstanceId} received user:updated event for user:`,
          user.name || user.nickname
        );

        if (userHash && state.userAgentMappings.has(userHash)) {
          console.log(`hREA Store: Syncing user profile changes to existing agent`);
          // Use debounced update to prevent race conditions
          debouncedUpdatePersonAgent(user, 300);
        } else if (userHash) {
          console.log(
            'hREA Store: User updated but no corresponding agent found. Creating new agent.'
          );
          // Use debounced creation for users without agents
          debouncedCreatePersonFromUser(user, 300);
        }
      });

      unsubscribeFunctions.push(unsubscribeUserCreated, unsubscribeUserUpdated);
      state.initialized = true;
      state.eventSubscriptionsActive = true;
      console.log(
        `hREA Store: Event subscriptions set up successfully for instance ${storeInstanceId}`
      );
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

      console.log('hREA Store: Disposed successfully');
    };

    const initialize = (): E.Effect<void, HreaError> => {
      console.log(`hREA Store: Initializing instance ${storeInstanceId}...`);
      setLoading(true);

      return pipe(
        hreaService.initialize(),
        E.tap((client) =>
          E.sync(() => {
            state.apolloClient = client;
            console.log(`hREA Store: Apollo Client initialized for instance ${storeInstanceId}`);
          })
        ),
        E.tap(() => {
          // Event subscriptions are already set up during store creation
          console.log(`hREA Store: Instance ${storeInstanceId} initialized successfully`);
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
      console.log(
        `hREA Store: Creating retroactive mappings for ${users.length} users in instance ${storeInstanceId}`
      );

      return pipe(
        // Start with a void effect and ensure initialization
        E.void,
        E.flatMap(() => {
          if (!state.apolloClient) {
            console.log(`hREA Store: Auto-initializing before createRetroactiveMappings call`);
            return initialize();
          }
          return E.void;
        }),
        // First get all existing agents
        E.flatMap(() => hreaService.getAgents()),
        E.tap((agents) =>
          E.sync(() => {
            console.log(
              `hREA Store: Found ${agents.length} existing agents for retroactive mapping`
            );

            // For each agent, try to find a matching user
            agents.forEach((agent) => {
              // Check if we already have a mapping for this agent
              const existingMapping = Array.from(state.userAgentMappings.entries()).find(
                ([_, agentId]) => agentId === agent.id
              );

              if (existingMapping) {
                console.log(`hREA Store: Agent ${agent.id} already has mapping, skipping`);
                return;
              }

              // Try to find matching user by name
              const matchingUser = users.find((user) => {
                return user.name === agent.name || user.nickname === agent.name;
              });

              if (matchingUser && matchingUser.original_action_hash) {
                const userHash = matchingUser.original_action_hash.toString();
                console.log(
                  `hREA Store: Creating retroactive mapping for user "${matchingUser.name || matchingUser.nickname}" -> agent "${agent.name}"`
                );
                addUserAgentMapping(userHash, agent.id);
              } else {
                console.log(`hREA Store: No matching user found for agent "${agent.name}"`);
              }
            });
          })
        ),
        E.asVoid,
        E.catchAll((error) => {
          console.warn('hREA Store: Failed to create retroactive mappings (non-critical):', error);
          return E.void; // Don't fail the store creation if this fails
        })
      );
    };

    return {
      get userAgentMappings() {
        console.log(
          `hREA Store: Accessing userAgentMappings, current size: ${state.userAgentMappings.size} (Store instance: ${storeInstanceId})`
        );
        if (state.userAgentMappings.size > 0) {
          console.log(
            `hREA Store: Current mappings: ${JSON.stringify(Object.fromEntries(state.userAgentMappings))} (Store instance: ${storeInstanceId})`
          );
        } else {
          console.log(
            `hREA Store: No mappings found in instance ${storeInstanceId}. Event subscriptions active: ${state.eventSubscriptionsActive}`
          );
        }
        return state.userAgentMappings;
      },
      get agents() {
        return state.agents;
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
    console.log(`hREA Store: Returning existing store instance (ID: ${_currentStoreId})`);
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
    console.log(`hREA Store: Initializing NEW singleton instance (ID: ${_currentStoreId})`);
    const storeEffect = pipe(createHreaStore(), E.provide(hreaStoreLayer));
    _hreaStore = E.runSync(storeEffect);
    console.log(`hREA Store: Singleton instance created successfully (ID: ${_currentStoreId})`);
    console.log(
      `hREA Store: Initial mappings size: ${_hreaStore.userAgentMappings.size} (ID: ${_currentStoreId})`
    );
    return _hreaStore;
  } finally {
    _isInitializing = false;
  }
};

// Reset function for testing/development
const resetHreaStore = () => {
  console.log(`hREA Store: RESETTING store instance (Previous ID: ${_currentStoreId})`);
  if (_hreaStore && typeof _hreaStore.dispose === 'function') {
    _hreaStore.dispose();
  }
  _hreaStore = null;
  _isInitializing = false;
  _initializationPromise = null;
  _currentStoreId = null;
  console.log('hREA Store: Reset completed - all state cleared');
};

const hreaStore = new Proxy({} as HreaStore, {
  get(target, prop) {
    // Special handling for reset function (for development/testing)
    if (prop === '_reset') {
      return resetHreaStore;
    }

    // Only log for debugging-relevant properties or when accessing mappings
    if (prop === 'userAgentMappings') {
      console.log(
        `hREA Store: Proxy access to 'userAgentMappings' (Store ID: ${_currentStoreId || 'unknown'})`
      );
    }

    const store = getHreaStore();
    const value = store[prop as keyof HreaStore];
    const result = typeof value === 'function' ? value.bind(store) : value;

    if (prop === 'userAgentMappings') {
      const size = (result as Map<string, string>).size;
      console.log(
        `hREA Store: Returning userAgentMappings with size: ${size} (Store ID: ${_currentStoreId})`
      );
    }

    return result;
  }
});

export default hreaStore;
