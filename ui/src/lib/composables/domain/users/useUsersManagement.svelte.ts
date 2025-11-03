import type { UIUser, BaseComposableState } from '$lib/types/ui';
import administrationStore from '$lib/stores/administration.store.svelte';
import { showToast } from '$lib/utils';

export interface UsersManagementState extends BaseComposableState {
  users: readonly UIUser[];
  filter: 'all' | 'pending' | 'accepted' | 'rejected' | 'suspended';
}

export interface UsersManagementActions {
  loadUsers: () => Promise<void>;
  setFilter: (filter: 'all' | 'pending' | 'accepted' | 'rejected' | 'suspended') => void;
}

export interface UseUsersManagement extends UsersManagementState, UsersManagementActions {}

export function useUsersManagement(
  options: { filter?: 'all' | 'pending' | 'accepted' | 'rejected' | 'suspended' } = {
    filter: 'all'
  }
): UseUsersManagement {
  // State
  const state = $state<UsersManagementState>({
    isLoading: true,
    error: null,
    users: [],
    filter: options.filter || 'all'
  });

  const { allUsers } = $derived(administrationStore);

  const filteredUsers = $derived.by(() => {
    if (state.filter === 'all') return allUsers;
    if (state.filter === 'suspended') {
      return allUsers.filter(
        (u) =>
          u.status?.status_type === 'suspended temporarily' ||
          u.status?.status_type === 'suspended indefinitely'
      );
    }
    return allUsers.filter((u) => u.status?.status_type === state.filter);
  });

  $effect(() => {
    state.users = filteredUsers;
    // When users are updated, we can assume loading is done if it was in progress
    if (state.isLoading) {
      state.isLoading = false;
    }
  });

  // Actions
  async function loadUsers() {
    state.isLoading = true;
    state.error = null;
    try {
      await administrationStore.fetchAllUsers();
    } catch (e: unknown) {
      const errorMessage = (e as Error)?.message || 'Failed to load users';
      state.error = errorMessage;
      showToast(errorMessage, 'error');
      state.isLoading = false; // Set loading to false on error
    }
  }

  function setFilter(filter: 'all' | 'pending' | 'accepted' | 'rejected' | 'suspended') {
    state.filter = filter;
  }

  return {
    get users() {
      return state.users;
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
