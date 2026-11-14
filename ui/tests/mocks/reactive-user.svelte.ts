/**
 * A signed-in member a test can change, as the real users store's `currentUser` changes
 * when the profile is re-read. A plain object in a mock is not reactive, so a page that
 * wrongly re-ran on such a change looked fine under test.
 */
export const signedIn = $state<{ current: Record<string, unknown> | null }>({ current: null });
