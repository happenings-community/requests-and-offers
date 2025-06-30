/* eslint-disable @typescript-eslint/no-explicit-any */
import { HreaServiceTag, HreaServiceLive } from '$lib/services/zomes/hrea.service';
import { Data, Effect as E, Layer, pipe } from 'effect';
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

export class HreaStoreError extends Data.TaggedError('HreaStoreError')<{
  message: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): HreaStoreError {
    if (error instanceof Error) {
      return new HreaStoreError({
        message: `${context}: ${error.message}`,
        cause: error
      });
    }
    return new HreaStoreError({
      message: `${context}: ${String(error)}`,
      cause: error
    });
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type HreaStore = {
  readonly userAgentMappings: ReadonlyMap<string, string>; // userHash -> agentId
  readonly loading: boolean;
  readonly error: HreaError | null;
  readonly apolloClient: ApolloClient<any> | null;
  readonly initialize: () => E.Effect<void, HreaStoreError>;
  readonly createPersonFromUser: (user: UIUser) => E.Effect<Agent | null, HreaStoreError>;
  readonly updatePersonAgent: (params: {
    agentId: string;
    user: any;
  }) => E.Effect<Agent | null, HreaStoreError>;
  // For debugging/visualisation
  readonly dispose: () => void;
};

// ============================================================================
// STORE FACTORY
// ============================================================================

// Global flag to prevent duplicate event subscriptions
let _eventSubscriptionsSetUp = false;

export const createHreaStore = (): E.Effect<HreaStore, never, HreaServiceTag> =>
  E.gen(function* () {
    const hreaService = yield* HreaServiceTag;
    const state = $state({
      userAgentMappings: new Map<string, string>(), // userHash -> agentId
      loading: false,
      error: null as HreaError | null,
      apolloClient: null as ApolloClient<any> | null,
      initialized: false // Add initialization flag
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
      console.log(`hREA Store: Added mapping ${userHash} -> ${agentId}`);
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

    const createPersonFromUser = (user: any): E.Effect<Agent | null, HreaStoreError> => {
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
        hreaService.createPerson({ name, note }),
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
        E.mapError((error) => HreaStoreError.fromError(error, 'Failed to create person from user'))
      );
    };

    const updatePersonAgent = (params: {
      agentId: string;
      user: any;
    }): E.Effect<Agent | null, HreaStoreError> => {
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
        hreaService.updatePerson({
          id: params.agentId,
          name,
          note
        }),
        E.tap((updatedAgent) =>
          E.sync(() => {
            console.log(
              `hREA Store: Successfully updated Person Agent "${updatedAgent.id}" for user "${name}"`
            );
          })
        ),
        E.tapError((error) =>
          E.sync(() => {
            console.error(`hREA Store: Failed to update Person Agent "${params.agentId}":`, error);
          })
        ),
        E.ensuring(
          E.sync(() => {
            // Always remove from in-flight operations
            inFlightOperations.delete(`update-${userHash}`);
          })
        ),
        E.mapError((error) => HreaStoreError.fromError(error, ERROR_CONTEXTS.UPDATE_PERSON))
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
      // Only set up event subscriptions once globally
      if (_eventSubscriptionsSetUp) {
        console.log('hREA Store: Event subscriptions already set up globally, skipping');
        return;
      }

      console.log('hREA Store: Setting up event subscriptions');

      // Subscribe to user creation events to auto-create person agents
      const unsubscribeUserCreated = storeEventBus.on('user:created', (payload) => {
        const { user } = payload;
        console.log(
          'hREA Store: Received user:created event for user:',
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
          'hREA Store: Received user:updated event for user:',
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
      _eventSubscriptionsSetUp = true;
      state.initialized = true;
      console.log('hREA Store: Event subscriptions set up successfully');
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

      console.log('hREA Store: Disposed successfully');
    };

    const initialize = (): E.Effect<void, HreaStoreError> => {
      // Prevent multiple initializations
      if (state.apolloClient) {
        console.log('hREA Store: Already initialized, skipping');
        return E.succeed(undefined);
      }

      return pipe(
        E.sync(() => {
          setLoading(true);
          setError(null);
        }),
        E.flatMap(() => hreaService.initialize()),
        E.tap((apolloClient) =>
          E.sync(() => {
            state.apolloClient = apolloClient;
            console.log('hREA service initialized successfully');
          })
        ),
        E.map(() => undefined),
        E.tapError((error) =>
          E.sync(() => setError(HreaError.fromError(error, ERROR_CONTEXTS.INITIALIZE)))
        ),
        E.mapError((error) => HreaStoreError.fromError(error, ERROR_CONTEXTS.INITIALIZE)),
        E.ensuring(E.sync(() => setLoading(false)))
      );
    };

    return {
      get userAgentMappings() {
        return state.userAgentMappings;
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
      dispose
    };
  });

// ============================================================================
// SVELTE STORE SINGLETON
// ============================================================================

const hreaStoreLayer = Layer.provide(HreaServiceLive, HolochainClientLive);

let _hreaStore: HreaStore | null = null;
let _isInitializing = false;
let _initializationPromise: Promise<HreaStore> | null = null;

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

  try {
    console.log('hREA Store: Initializing singleton instance');
    const storeEffect = pipe(createHreaStore(), E.provide(hreaStoreLayer));
    _hreaStore = E.runSync(storeEffect);
    console.log('hREA Store: Singleton instance created successfully');
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
  _eventSubscriptionsSetUp = false; // Reset event subscriptions flag
  console.log('hREA Store: Reset completed');
};

const hreaStore = new Proxy({} as HreaStore, {
  get(target, prop) {
    // Special handling for reset function (for development/testing)
    if (prop === '_reset') {
      return resetHreaStore;
    }

    const store = getHreaStore();
    const value = store[prop as keyof HreaStore];
    return typeof value === 'function' ? value.bind(store) : value;
  }
});

export default hreaStore;
