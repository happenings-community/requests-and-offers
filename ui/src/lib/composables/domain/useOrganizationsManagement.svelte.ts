import type { ActionHash } from '@holochain/client';
import type { UIOrganization, BaseComposableState } from '$lib/types/ui';
import organizationsStore from '$lib/stores/organizations.store.svelte';
import { Data } from 'effect';
import { showToast } from '$lib/utils';
import { useModal } from '$lib/utils/composables';
import administrationStore from '$lib/stores/administration.store.svelte';

// Typed error for the composable
export class OrganizationsManagementError extends Data.TaggedError('OrganizationsManagementError')<{
  message: string;
  context?: string;
  cause?: unknown;
}> {}

export interface OrganizationsManagementState extends BaseComposableState {
  organizations: UIOrganization[];
  filter: 'all' | 'pending' | 'accepted' | 'rejected';
}

export interface OrganizationsManagementActions {
  loadOrganizations: () => Promise<void>;
  deleteOrganization: (organizationHash: ActionHash) => Promise<void>;
  setFilter: (filter: 'all' | 'pending' | 'accepted' | 'rejected') => void;
}

export interface UseOrganizationsManagement
  extends OrganizationsManagementState,
    OrganizationsManagementActions {}

export function useOrganizationsManagement(
  options: { filter?: 'all' | 'pending' | 'accepted' | 'rejected' } = { filter: 'all' }
): UseOrganizationsManagement {
  const modal = useModal();

  // State
  let state = $state<OrganizationsManagementState>({
    isLoading: true,
    error: null,
    organizations: [],
    filter: options.filter || 'all'
  });

  const { allOrganizations } = $derived(administrationStore);

  const filteredOrganizations = $derived.by(() => {
    if (state.filter === 'all') return allOrganizations;
    return allOrganizations.filter((org) => org.status?.status_type === state.filter);
  });

  $effect(() => {
    state.organizations = filteredOrganizations;
    // When organizations are updated, we can assume loading is done if it was in progress
    if (state.isLoading) {
      state.isLoading = false;
    }
  });

  // Actions
  async function loadOrganizations() {
    state.isLoading = true;
    state.error = null;
    try {
      await administrationStore.fetchAllOrganizations();
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to load organizations';
      state.error = errorMessage;
      showToast(errorMessage, 'error');
      state.isLoading = false; // Set loading to false on error
    }
  }

  async function deleteOrganization(organizationHash: ActionHash) {
    const confirmed = await modal.confirm(
      'Are you sure you want to delete this organization?<br/>This action cannot be undone.',
      { confirmLabel: 'Delete', cancelLabel: 'Cancel' }
    );

    if (!confirmed) return;

    try {
      await organizationsStore.deleteOrganization(organizationHash);
      showToast('Organization deleted successfully', 'success');
      await loadOrganizations(); // Refresh list
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to delete organization';
      showToast(errorMessage, 'error');
    }
  }

  function setFilter(filter: 'all' | 'pending' | 'accepted' | 'rejected') {
    state.filter = filter;
  }

  return {
    get organizations() {
      return state.organizations;
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
    loadOrganizations,
    deleteOrganization,
    setFilter
  };
}
