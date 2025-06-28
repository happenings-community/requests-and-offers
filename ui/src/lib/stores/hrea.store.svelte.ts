/* eslint-disable @typescript-eslint/no-explicit-any */
import { HreaServiceTag, type HreaService } from '$lib/services/zomes/hrea.service';
import { Data, Effect as E, Layer, pipe } from 'effect';
import { HolochainClientLive } from '../services/holochainClient.service';
import { HreaServiceLive } from '../services/zomes/hrea.service';
import { HreaError } from '$lib/errors';
import type { Agent } from '$lib/types/hrea';

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
  readonly initialize: () => E.Effect<void, HreaStoreError>;
  readonly createPerson: (params: {
    name: string;
    note?: string;
  }) => E.Effect<void, HreaStoreError>;
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
      error: null as HreaError | null
    });

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
      initialize,
      createPerson
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
