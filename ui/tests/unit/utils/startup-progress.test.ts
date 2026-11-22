import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { startupProgress } from '$lib/utils/startup-progress';

describe('startupProgress', () => {
  it('is the share of steps finished, a skipped step counting as finished', () => {
    expect(startupProgress([{ status: 'completed' }, { status: 'running' }])).toBe(50);
    expect(startupProgress([{ status: 'completed' }, { status: 'skipped' }])).toBe(100);
    expect(startupProgress([{ status: 'pending' }, { status: 'failed' }])).toBe(0);
    expect(startupProgress([])).toBe(0);
  });
});

/**
 * The start-up screen never sits still (dogfooding, 22 November 2026: the spinner stopped at
 * 67% for 10 to 15 seconds on a new network, which read as a hang). Every read the start-up
 * waits on happens while a step shows as running. Read from the source, as
 * `page-position.test.ts` does, because the suite does not mount the root layout.
 */
describe('the start-up steps', () => {
  const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
  const after = (needle: string, from = 0) => {
    const at = layout.indexOf(needle, from);
    expect(at, needle).toBeGreaterThan(-1);
    return at;
  };

  /** **To make this go red:** mark the hREA step completed before its agents and specifications are read. */
  it('keeps the hREA step running until its agents and specifications are read', () => {
    const step = after('const initializeHreaStep');
    const read = after('hreaStore.getAllAgents()', step);
    const done = after("updateStep('hrea', 'completed'", step);
    expect(done, 'completed only after the read').toBeGreaterThan(read);
    const loading = after(
      "updateStep('hrea', 'running', 'Loading members and categories...'",
      step
    );
    expect(loading, 'says what it is waiting for, just before the read').toBeLessThan(read);
  });

  /** **To make this go red:** load the member's profile without its own step. */
  it("shows the member's profile as a step while it loads", () => {
    expect(layout).toMatch(/\{ name: 'Your Profile', status: 'pending'/);
    const step = after('const loadUserDataStep');
    const running = after("updateStep('profile', 'running'", step);
    const read = after('usersStore.refreshCurrentUser()', step);
    expect(running).toBeLessThan(read);
    // Completed after the profile read and after Moss's profile read, which in Moss follows it.
    const done = after("updateStep('profile', 'completed'", step);
    expect(done).toBeGreaterThan(read);
    expect(done).toBeGreaterThan(after('weaveStore.initialize(', step));
  });

  /** **To make this go red:** read whether hREA started from how its effect ended. */
  it('reads whether hREA started from the client it left, since its start swallows failures', () => {
    const step = after('const initializeHreaStep');
    // After the bootstrap read, which can start the service itself.
    const read = after('hreaStore.getAllAgents()', step);
    const check = after('hreaStore.apolloClient !== null', step);
    expect(check).toBeGreaterThan(read);
    expect(check).toBeLessThan(after("updateStep('hrea', 'completed'", step));
  });
});
