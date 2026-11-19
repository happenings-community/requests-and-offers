/**
 * The administration store's member list, as a test can change it: a reactive array that
 * the store changes in place, as the real store does when an administrator writes a status
 * (`allUsers.splice`). A plain array in a mock is not reactive, so a page that stopped
 * following the store looked fine under test.
 */
import type { UIUser } from '$lib/types/ui';

export const admin = $state<{ allUsers: UIUser[] }>({ allUsers: [] });
