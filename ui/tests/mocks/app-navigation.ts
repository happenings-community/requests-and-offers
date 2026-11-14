import { vi } from 'vitest';

/**
 * `$app/navigation` for the test run, for the same reason as `app-state.ts`.
 *
 * A spy rather than a no-op, so a test can say where a page sent the member. Reset it in
 * `beforeEach` like any other spy.
 */
export const goto = vi.fn((href: string) => Promise.resolve(void href));
