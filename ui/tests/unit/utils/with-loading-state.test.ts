import { describe, it, expect } from 'vitest';
import { Effect as E, Exit, Fiber } from 'effect';
import { withLoadingState } from '$lib/utils/store-helpers/core';

/**
 * `withLoadingState` raises a store's loading flag around an operation and lowers it when the
 * operation ends. It lowered it on success and on failure but not on interruption, so a fetch a
 * component interrupted (a task's fiber is interrupted when its component goes away) left the
 * flag on `true` for good, and anything that waits for `loading` to be false never ran again.
 * The admin status guard does exactly that.
 */

/** A pair of setters over plain variables, as a store's `$state` flags are. */
const flags = () => {
  const state = { loading: false, error: null as string | null, sets: [] as boolean[] };
  return {
    state,
    setters: {
      setLoading: (value: boolean) => {
        state.loading = value;
        state.sets.push(value);
      },
      setError: (value: string | null) => {
        state.error = value;
      }
    }
  };
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('withLoadingState', () => {
  it('raises the flag while the operation runs and lowers it on success', async () => {
    const { state, setters } = flags();
    let during: boolean | undefined;

    const result = await E.runPromise(
      withLoadingState(() =>
        E.sync(() => {
          during = state.loading;
          return 'done';
        })
      )(setters)
    );

    expect(result).toBe('done');
    expect(during).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('lowers the flag and records the message on failure', async () => {
    const { state, setters } = flags();

    const exit = await E.runPromiseExit(
      withLoadingState(() => E.fail(new Error('refused')))(setters)
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.error).toBe('refused');
  });

  it('lowers the flag when the operation is interrupted', async () => {
    const { state, setters } = flags();

    const fiber = E.runFork(withLoadingState(() => E.never as E.Effect<string, never>)(setters));
    await tick();
    expect(state.loading).toBe(true);

    await E.runPromise(Fiber.interrupt(fiber));

    expect(state.loading).toBe(false);
    // An interruption is not an error: nothing is reported to the member.
    expect(state.error).toBeNull();
  });

  it('lowers the flag when a slow fetch is interrupted by its owner going away', async () => {
    const { state, setters } = flags();
    const slow = E.sleep('1 hour').pipe(E.as('late'));

    const fiber = E.runFork(withLoadingState(() => slow)(setters));
    await tick();
    expect(state.loading).toBe(true);

    await E.runPromise(Fiber.interrupt(fiber));

    expect(state.loading).toBe(false);
  });
});
