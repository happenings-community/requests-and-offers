import { describe, it, expect, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { render, cleanup } from '@testing-library/svelte';
import { Deferred, Effect as E, Exit, Fiber, Option } from 'effect';
import EffectTaskHost from '../../mocks/EffectTaskHost.svelte';
import type { useEffectTask } from '$lib/composables/ui/useEffectTask.svelte';

/**
 * A task is a fiber owned by the component that started it. The invariant: mount a component,
 * start a task, unmount it, and the fiber's exit is Interrupted. Without it, `E.runPromise`
 * lets a late response resolve into a destroyed component (#134).
 */

type Task = ReturnType<typeof useEffectTask<string, string>>;

/** Mounts the host and returns its task, with the component's effects flushed. */
function mountTask() {
  let task!: Task;
  const view = render(EffectTaskHost, { props: { onTask: (t: Task) => (task = t) } });
  flushSync();
  return { task, ...view };
}

const exitOf = (task: Task) => Option.getOrThrow(task.exit);

beforeEach(() => cleanup());

describe('a task owned by a component', () => {
  it('interrupts its fiber when the component unmounts, and the exit is Interrupted', async () => {
    const { task, unmount } = mountTask();
    let finalised = false;
    const never = E.never.pipe(
      E.onInterrupt(() =>
        E.sync(() => {
          finalised = true;
        })
      )
    ) as E.Effect<string, string>;

    const fiber = task.run(never);
    await Promise.resolve();
    expect(task.running).toBe(true);

    unmount();

    const result = await E.runPromise(Fiber.await(fiber));
    expect(Exit.isInterrupted(result)).toBe(true);
    expect(finalised).toBe(true);
  });

  it('never writes a late success into a destroyed component', async () => {
    const { task, unmount } = mountTask();
    const gate = E.runSync(Deferred.make<string, string>());
    const fiber = task.run(Deferred.await(gate));

    unmount();
    await E.runPromise(Fiber.await(fiber));
    // The response arrives after the component is gone.
    E.runSync(Deferred.succeed(gate, 'late'));
    await Promise.resolve();

    expect(task.running).toBe(false);
    expect(Exit.isInterrupted(exitOf(task))).toBe(true);
  });

  it('records a success and stops running', async () => {
    const { task } = mountTask();
    const fiber = task.run(E.succeed('done'));
    await E.runPromise(Fiber.await(fiber));

    expect(task.running).toBe(false);
    const result = exitOf(task);
    expect(Exit.isSuccess(result) && result.value).toBe('done');
  });

  it('records a failure as an exit rather than throwing', async () => {
    const { task } = mountTask();
    const fiber = task.run(E.fail('refused'));
    await E.runPromise(Fiber.await(fiber));

    expect(task.running).toBe(false);
    expect(Exit.isFailure(exitOf(task))).toBe(true);
  });

  it('has no exit before it has run', () => {
    const { task } = mountTask();
    expect(Option.isNone(task.exit)).toBe(true);
    expect(task.running).toBe(false);
  });

  it('cancel interrupts the run and records Interrupted', async () => {
    const { task } = mountTask();
    const fiber = task.run(E.never as E.Effect<string, string>);
    task.cancel();
    await E.runPromise(Fiber.await(fiber));

    expect(task.running).toBe(false);
    expect(Exit.isInterrupted(exitOf(task))).toBe(true);
  });

  it('a new run interrupts the one in flight and keeps only the latest exit', async () => {
    const { task } = mountTask();
    const first = task.run(E.never as E.Effect<string, string>);
    const second = task.run(E.succeed('second'));

    const firstExit = await E.runPromise(Fiber.await(first));
    await E.runPromise(Fiber.await(second));

    expect(Exit.isInterrupted(firstExit)).toBe(true);
    // The interrupted run must not overwrite the run that replaced it.
    expect(task.running).toBe(false);
    const result = exitOf(task);
    expect(Exit.isSuccess(result) && result.value).toBe('second');
  });

  it('an interrupted run does not stop the run that replaced it', async () => {
    const { task } = mountTask();
    const gate = E.runSync(Deferred.make<string, string>());
    task.run(E.never as E.Effect<string, string>);
    const second = task.run(Deferred.await(gate));
    await Promise.resolve();
    await Promise.resolve();

    expect(task.running).toBe(true);

    E.runSync(Deferred.succeed(gate, 'ok'));
    await E.runPromise(Fiber.await(second));
    expect(task.running).toBe(false);
  });
});
