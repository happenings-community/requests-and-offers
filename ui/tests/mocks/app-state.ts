// Stand-in for SvelteKit's `$app/state` in unit tests, so a route page can be mounted.
// A test that needs other params replaces it with vi.mock('$app/state', ...).
export const page = { params: {} as Record<string, string>, url: new URL('http://localhost/') };
