/**
 * Loads the mock data helpers (and faker with them) only in builds where the
 * mock buttons are switched on.
 *
 * Vite replaces `import.meta.env.VITE_MOCK_BUTTONS_ENABLED` with a literal at
 * build time. When it is not 'true', the condition below is a constant and the
 * bundler drops the dynamic import, so `$lib/utils/mocks` and faker never reach
 * the built app. A static `import ... from '$lib/utils/mocks'` anywhere in the
 * app would undo this: always go through `loadMocks()`.
 */
export function loadMocks(): Promise<typeof import('$lib/utils/mocks')> {
  return import.meta.env.VITE_MOCK_BUTTONS_ENABLED === 'true'
    ? import('$lib/utils/mocks')
    : Promise.reject(new Error('Mock data is switched off in this build'));
}
