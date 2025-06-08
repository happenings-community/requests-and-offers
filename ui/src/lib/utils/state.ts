/**
 * UI State management utilities for Svelte 5 applications
 *
 * This file provides utility functions for managing loading states, error states,
 * and other reactive UI concerns using Svelte 5 runes.
 */

import { Effect as E, pipe } from 'effect';

/**
 * Configuration for UI state management
 */
export interface UiStateConfig<E> {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  errorToString?: (error: E) => string;
}

/**
 * Wraps an Effect with loading and error state management
 *
 * @param operation - The Effect to wrap
 * @param config - Configuration for state setters
 * @returns The wrapped Effect
 */
export const withUiState = <A, E>(
  operation: E.Effect<A, E>,
  config: UiStateConfig<E>
): E.Effect<A, E> => {
  const { setLoading, setError, errorToString = String } = config;

  return pipe(
    E.sync(() => {
      setLoading(true);
      setError(null);
    }),
    E.flatMap(() => operation),
    E.tap(() => E.sync(() => setLoading(false))),
    E.tapError((error) =>
      E.sync(() => {
        setLoading(false);
        setError(errorToString(error));
      })
    )
  );
};

/**
 * Creates a higher-order function that wraps operations with loading/error state management
 * This is the pattern used in stores throughout the application
 *
 * @param setLoading - Function to set loading state
 * @param setError - Function to set error state
 * @param errorToString - Optional function to convert errors to strings
 * @returns A function that wraps Effects with state management
 */
export const createStateManager =
  <E = unknown>(
    setLoading: (loading: boolean) => void,
    setError: (error: string | null) => void,
    errorToString: (error: E) => string = String
  ) =>
  <A>(operation: () => E.Effect<A, E>): E.Effect<A, E> =>
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
          setError(errorToString(error));
        })
      )
    );

/**
 * Creates a loading and error state manager for Svelte components
 * Returns reactive state variables and functions to manage them
 */
export const createLoadingState = () => {
  let loading = $state(false);
  let error = $state<string | null>(null);

  const setLoading = (value: boolean) => {
    loading = value;
  };

  const setError = (value: string | null) => {
    error = value;
  };

  const clearError = () => {
    error = null;
  };

  const reset = () => {
    loading = false;
    error = null;
  };

  return {
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    setLoading,
    setError,
    clearError,
    reset,
    withState: createStateManager(setLoading, setError)
  };
};

/**
 * Wraps an async function with loading and error state management
 *
 * @param asyncFn - The async function to wrap
 * @param setLoading - Function to set loading state
 * @param setError - Function to set error state
 * @returns A wrapped function that manages state
 */
export const withAsyncState =
  <TArgs extends unknown[], TReturn>(
    asyncFn: (...args: TArgs) => Promise<TReturn>,
    setLoading: (loading: boolean) => void,
    setError: (error: string | null) => void
  ) =>
  async (...args: TArgs): Promise<TReturn | null> => {
    try {
      setLoading(true);
      setError(null);
      const result = await asyncFn(...args);
      return result;
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setLoading(false);
    }
  };
