import { Effect as E, Exit, Fiber, Option } from 'effect';

/**
 * What a task has produced: nothing yet (`none`), or the exit of its last run.
 * An interrupted run is an exit too, so a component can tell "cancelled" from "never ran".
 */
export type TaskExit<A, Err> = Option.Option<Exit.Exit<A, Err>>;

/**
 * Runs an already-provided Effect as a fiber owned by the calling component.
 *
 * `E.runPromise` returns a Promise and no fiber, so a component that unmounts mid-fetch
 * cannot stop its own work: the request resolves into a destroyed component. A task is a
 * fiber the component owns, interrupted when the component's effect scope tears down, so a
 * late response can never write into a destroyed component.
 *
 * Call it once, during component initialisation, like any rune-based composable:
 *
 * ```svelte
 * const statusTask = useEffectTask<UIStatus, AdministrationError>();
 * $effect(() => { statusTask.run(administrationStore.getLatestStatusForEntity(hash)); });
 * ```
 *
 * Starting a run while one is in flight interrupts the first, and only the latest run's exit
 * is kept. The effect must have its services provided already (`R` is `never`).
 */
export function useEffectTask<A, Err>() {
  let running = $state(false);
  let exit = $state<TaskExit<A, Err>>(Option.none());
  let fiber: Fiber.RuntimeFiber<A, Err> | null = null;
  /** Identifies the latest run, so an interrupted run cannot overwrite its replacement's state. */
  let generation = 0;

  const interrupt = (target: Fiber.RuntimeFiber<A, Err>) => {
    E.runFork(Fiber.interrupt(target));
  };

  const run = (effect: E.Effect<A, Err>): Fiber.RuntimeFiber<A, Err> => {
    if (fiber) interrupt(fiber);
    const mine = ++generation;
    running = true;
    const started = E.runFork(
      effect.pipe(
        E.onExit((result) =>
          E.sync(() => {
            if (mine !== generation) return;
            exit = Option.some(result);
            running = false;
            fiber = null;
          })
        )
      )
    );
    fiber = started;
    return started;
  };

  const cancel = () => {
    if (fiber) interrupt(fiber);
  };

  // The teardown of the component's effect scope. An interrupted fiber records its own
  // interrupted exit, so a destroyed component is left with `Interrupted`, never a late success.
  $effect(() => cancel);

  return {
    get running() {
      return running;
    },
    get exit() {
      return exit;
    },
    run,
    cancel
  };
}

/**
 * The value of a task's last run, or `undefined` while there is none: before it has run,
 * while it runs for the first time, and after a failure or an interruption.
 * It reads `task.exit`, so inside `$derived` or a template it stays reactive.
 */
export function taskValue<A, Err>(task: { readonly exit: TaskExit<A, Err> }): A | undefined {
  return Option.match(task.exit, {
    onNone: () => undefined,
    onSome: (result) => (Exit.isSuccess(result) ? result.value : undefined)
  });
}
