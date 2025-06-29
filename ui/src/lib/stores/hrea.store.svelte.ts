/* eslint-disable @typescript-eslint/no-explicit-any */
import { HreaServiceTag, type HreaService } from '$lib/services/zomes/hrea.service';
import { Data, Effect as E, Layer, pipe } from 'effect';
import { HolochainClientLive } from '../services/holochainClient.service';
import { HreaServiceLive } from '../services/zomes/hrea.service';
import { storeEventBus } from '$lib/stores/storeEvents';
import { HreaError } from '$lib/errors';
import type { Agent } from '$lib/types/hrea';
import type { ApolloClient } from '@apollo/client/core';

// ============================================================================
// CONSTANTS
// ============================================================================

const ERROR_CONTEXTS = {
  INITIALIZE: 'Failed to initialize hREA service',
  CREATE_PERSON: 'Failed to create person agent'
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
  readonly agents: ReadonlyArray<Agent>;
  readonly loading: boolean;
  readonly error: HreaError | null;
  readonly apolloClient: ApolloClient<any> | null;
  readonly initialize: () => E.Effect<void, HreaStoreError>;
  readonly createPerson: (params: {
    name: string;
    note?: string;
  }) => E.Effect<void, HreaStoreError>;
  // For debugging/visualisation
  readonly dispose: () => void;
};

// ============================================================================
// STORE FACTORY
// ============================================================================

export const createHreaStore = (): E.Effect<HreaStore, never, HreaServiceTag> =>
  E.gen(function* () {
    const hreaService = yield* HreaServiceTag;
    const state = $state({
      agents: [] as Agent[],
      loading: false,
      error: null as HreaError | null,
      apolloClient: null as ApolloClient<any> | null
    });

    const unsubscribeFunctions: Array<() => void> = [];

    const setLoading = (loading: boolean) => {
      state.loading = loading;
    };

    const setError = (error: HreaError | null) => {
      state.error = error;
    };

    const addAgent = (agent: Agent) => {
      state.agents.push(agent);
    };

    const initialize = (): E.Effect<void, HreaStoreError> =>
      pipe(
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

    const createPerson = (params: { name: string; note?: string }) =>
      pipe(
        E.sync(() => {
          setLoading(true);
          setError(null);
        }),
        E.flatMap(() => hreaService.createPerson(params)),
        E.tap((newAgent) => E.sync(() => addAgent(newAgent))),
        E.map(() => undefined),
        E.tapError((error) =>
          E.sync(() => setError(HreaError.fromError(error, ERROR_CONTEXTS.CREATE_PERSON)))
        ),
        E.mapError((error) => HreaStoreError.fromError(error, ERROR_CONTEXTS.CREATE_PERSON)),
        E.ensuring(E.sync(() => setLoading(false)))
      );

    const setupEventSubscriptions = (): void => {
      // Subscribe to user creation events to auto-create person agents
      const unsubscribeUserCreated = storeEventBus.on('user:created', (payload) => {
        const { user } = payload;
        const displayName = (user as any).nickname || 'New User';

        // Run the person creation effect
        pipe(createPerson({ name: displayName, note: user.bio || '' }), E.runPromise).catch((err) =>
          console.error('hreaStore: Failed to auto-create person agent from event', err)
        );
      });

      unsubscribeFunctions.push(unsubscribeUserCreated);
    };

    // Set up event subscriptions
    setupEventSubscriptions();

    const dispose = () => {
      unsubscribeFunctions.forEach((unsubscribe) => {
        unsubscribe();
      });
    };

    return {
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
      createPerson,
      dispose
    };
  });

// ============================================================================
// SVELTE STORE SINGLETON
// ============================================================================

const hreaStoreLayer = Layer.provide(HreaServiceLive, HolochainClientLive);

let _hreaStore: HreaStore | null = null;

const getHreaStore = (): HreaStore => {
  if (_hreaStore) {
    return _hreaStore;
  }

  const storeEffect = pipe(createHreaStore(), E.provide(hreaStoreLayer));

  _hreaStore = E.runSync(storeEffect);

  return _hreaStore;
};

const hreaStore = new Proxy({} as HreaStore, {
  get(target, prop) {
    const store = getHreaStore();
    const value = store[prop as keyof HreaStore];
    return typeof value === 'function' ? value.bind(store) : value;
  }
});

export default hreaStore;
