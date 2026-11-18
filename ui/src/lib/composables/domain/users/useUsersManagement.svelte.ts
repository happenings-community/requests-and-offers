import type { UIUser, BaseComposableState } from '$lib/types/ui';
import administrationStore from '$lib/stores/administration.store.svelte';
import { Effect as E, pipe } from 'effect';
import { showToast } from '$lib/utils';
import type { Effect } from 'effect/Effect';

export interface UsersManagementState extends BaseComposableState {
  users: readonly UIUser[];
  filter: 'all' | 'pending' | 'accepted' | 'rejected' | 'suspended';
}

export interface UsersManagementActions {
  loadUsers: () => Effect<void>;
  setFilter: (filter: 'all' | 'pending' | 'accepted' | 'rejected' | 'suspended') => void;
}

export interface UseUsersManagement extends UsersManagementState, UsersManagementActions {}

export function useUsersManagement(
  options: { filter?: 'all' | 'pending' | 'accepted' | 'rejected' | 'suspended' } = {
    filter: 'all'
  }
): UseUsersManagement {
  // State
  // **No copy of the list.** `users` is the store's list, filtered, read each time: the
  // store changes its array in place, so a copy taken from it misses every later status.
  const state = $state<Omit<UsersManagementState, 'users'>>({
    isLoading: true,
    error: null,
    filter: options.filter || 'all'
  });

  const { allUsers } = $derived(administrationStore);

  const filteredUsers = $derived.by(() => {
    const result =
      state.filter === 'all'
        ? allUsers
        : state.filter === 'suspended'
          ? allUsers.filter(
              (u) =>
                u.status?.status_type === 'suspended temporarily' ||
                u.status?.status_type === 'suspended indefinitely'
            )
          : allUsers.filter((u) => u.status?.status_type === state.filter);

    console.log('🔄 useUsersManagement - filteredUsers updated:', {
      filter: state.filter,
      totalUsers: allUsers.length,
      filteredCount: result.length,
      usersByStatus: result.reduce(
        (acc, user) => {
          const status = user.status?.status_type || 'unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      )
    });

    return result;
  });

  function loadUsers() {
    state.isLoading = true;
    state.error = null;

    return pipe(
      administrationStore.fetchAllUsers(),
      E.map(() => {
        state.isLoading = false; // Success: stop loading; the list is the store's
      }),
      E.catchAll((error) => {
        const errorMessage = error.message || 'Failed to load users';
        state.error = errorMessage;

        return pipe(
          E.asVoid(E.sync(() => showToast(errorMessage, 'error'))),
          E.tap(() =>
            E.sync(() => {
              state.isLoading = false; // Ensure loading stops
            })
          )
        );
      })
    );
  }

  function setFilter(filter: 'all' | 'pending' | 'accepted' | 'rejected' | 'suspended') {
    state.filter = filter;
  }

  return {
    get users() {
      return filteredUsers;
    },
    get isLoading() {
      return state.isLoading;
    },
    get error() {
      return state.error;
    },
    get filter() {
      return state.filter;
    },
    loadUsers,
    setFilter
  };
}
