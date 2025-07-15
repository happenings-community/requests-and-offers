import type { ActionHash } from '@holochain/client';
import type { UIOffer, BaseComposableState, UIUser } from '$lib/types/ui';
// Note: Using local error types for now during bridge implementation
import offersStore from '$lib/stores/offers.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import administrationStore from '$lib/stores/administration.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils';
import { useModal } from '$lib/utils/composables';
import { Effect as E, Data, pipe } from 'effect';
import { OfferError } from '$lib/errors';
import { page } from '$app/state';
import { goto } from '$app/navigation';
// StoreEventBus is now a global singleton and doesn't need to be imported or provided

export interface OffersManagementState extends BaseComposableState {
  filteredOffers: UIOffer[];
  filterType: 'all' | 'my' | 'organization';
  hasInitialized: boolean;
}

export interface OffersManagementActions {
  initialize: () => Promise<void>;
  loadOffers: () => Promise<void>;
  deleteOffer: (offerHash: ActionHash) => Promise<void>;
  setFilterType: (filterType: 'all' | 'my' | 'organization') => void;
  getUserDisplayName: (user: UIUser | null) => string;
}

export interface UseOffersManagement extends OffersManagementState, OffersManagementActions {
  offers: readonly UIOffer[];
  storeError: string | null;
  storeLoading: boolean;
  currentUser: UIUser | null;
  canCreateOffers: boolean;
}

export function useOffersManagement(): UseOffersManagement {
  const modal = useModal();

  // Initialize filter type from URL parameters
  const getInitialFilterType = (): 'all' | 'my' | 'organization' => {
    if (!page.url) return 'all';
    const filterParam = page.url.searchParams.get('filter');
    if (filterParam === 'my' || filterParam === 'organization') {
      return filterParam;
    }
    return 'all';
  };

  // State
  let state = $state<OffersManagementState>({
    isLoading: true,
    error: null,
    filteredOffers: [],
    filterType: getInitialFilterType(),
    hasInitialized: false
  });

  // Track if we're programmatically changing the filter to avoid URL conflicts
  let isChangingFilterProgrammatically = false;

  // Handle URL parameter changes (only when not changing programmatically)
  $effect(() => {
    if (!page.url || isChangingFilterProgrammatically) return;

    const filterParam = page.url.searchParams.get('filter');
    if (filterParam === 'my' || filterParam === 'organization') {
      if (state.filterType !== filterParam) {
        state.filterType = filterParam;
      }
    } else if (filterParam === null && state.filterType !== 'all') {
      // If no filter parameter and current filter is not 'all', reset to 'all'
      state.filterType = 'all';
    }
  });

  // Reactive getters from stores
  const { offers, loading: storeLoading, error: storeError } = offersStore;
  const { currentUser } = usersStore;
  const { agentIsAdministrator } = $derived(administrationStore);

  // Filter offers based on current filter type
  const filteredOffers = $derived.by(() => {
    if (!offers.length) return [];

    const filterFunctions = {
      my: (offer: UIOffer) =>
        currentUser?.original_action_hash &&
        offer.creator &&
        offer.creator.toString() === currentUser.original_action_hash.toString(),

      organization: (offer: UIOffer) =>
        currentUser?.organizations?.length! > 0 &&
        offer.organization &&
        currentUser?.organizations?.some(
          (org) => org.toString() === offer.organization?.toString()
        ),

      all: () => true
    };

    const filterFunction = filterFunctions[state.filterType] || filterFunctions.all;
    return offers.filter(filterFunction);
  });

  // Update state when filtered offers change
  $effect(() => {
    state.filteredOffers = filteredOffers;
  });

  // Load offers using pure Effect patterns
  const loadOffersEffect = (): E.Effect<void, OfferError> =>
    pipe(
      E.sync(() => {
        state.isLoading = true;
        state.error = null;
      }),
      E.flatMap(() =>
        pipe(
          offersStore.getAllOffers(),
          E.mapError((error) => OfferError.fromError(error, 'getAllOffers'))
        )
      ),
      E.tap(() => {
        state.hasInitialized = true;
      }),
      E.asVoid,
      E.catchAll((error) => E.fail(OfferError.fromError(error, 'loadOffers'))),
      E.ensuring(
        E.sync(() => {
          state.isLoading = false;
        })
      )
    );

  // Load offers from the store
  async function loadOffers(): Promise<void> {
    try {
      await runEffect(loadOffersEffect());
    } catch (error) {
      const offersError = OfferError.fromError(error, 'loadOffers');
      state.error = offersError.message;
      showToast('Failed to load offers', 'error');
    }
  }

  // Load initial data using Effect composition
  const initializeEffect = (): E.Effect<void, OfferError> =>
    pipe(
      loadOffersEffect(),
      E.flatMap(() =>
        pipe(
          // Also refresh current user to ensure data is up-to-date
          usersStore.refreshCurrentUser(),
          E.catchAll((error) => {
            console.warn('Failed to refresh current user:', error);
            return E.void;
          })
        )
      )
    );

  async function initialize(): Promise<void> {
    if (state.hasInitialized) {
      return;
    }
    state.isLoading = true;
    try {
      await runEffect(initializeEffect());
    } catch (error) {
      const initError = OfferError.fromError(error, 'initialize');
      state.error = initError.message;
      showToast('Failed to initialize offers', 'error');
    } finally {
      state.isLoading = false;
    }
  }

  // Delete an offer with confirmation
  async function deleteOffer(offerHash: ActionHash): Promise<void> {
    try {
      const confirmed = await modal.confirm(
        'Are you sure you want to delete this offer?<br/>This action cannot be undone.',
        { confirmLabel: 'Delete', cancelLabel: 'Cancel' }
      );

      if (!confirmed) {
        return;
      }

      const deleteEffect = pipe(
        offersStore.deleteOffer(offerHash),
        E.flatMap(() => loadOffersEffect()),
        E.mapError((error) => OfferError.fromError(error, 'deleteOffer'))
      );

      await runEffect(deleteEffect);

      showToast('Offer deleted successfully!', 'success');
    } catch (error) {
      const deleteError = OfferError.fromError(error, 'deleteOffer');
      showToast(deleteError.message, 'error');
      state.error = deleteError.message;
    }
  }

  // Set filter type and update URL
  function setFilterType(filterType: 'all' | 'my' | 'organization'): void {
    isChangingFilterProgrammatically = true;
    state.filterType = filterType;

    // Update URL to reflect the new filter
    const url = new URL(window.location.href);
    if (filterType === 'all') {
      url.searchParams.delete('filter');
    } else {
      url.searchParams.set('filter', filterType);
    }

    // Use replaceState to avoid adding to browser history
    const newUrl = url.pathname + (url.search ? url.search : '');
    goto(newUrl, { replaceState: true });

    // Reset the flag after a short delay
    setTimeout(() => {
      isChangingFilterProgrammatically = false;
    }, 0);
  }

  // Get user display name helper
  function getUserDisplayName(user: UIUser | null): string {
    if (!user) return 'Anonymous';
    return user.nickname || 'Anonymous';
  }

  // Check if user can create offers (accepted users OR administrators)
  const canCreateOffers = $derived(
    currentUser?.status?.status_type === 'accepted' || agentIsAdministrator
  );

  // Return composable interface with proper reactivity
  return {
    // from state
    get isLoading() {
      return state.isLoading;
    },
    get error() {
      return state.error;
    },
    get filteredOffers() {
      return state.filteredOffers;
    },
    get filterType() {
      return state.filterType;
    },
    get hasInitialized() {
      return state.hasInitialized;
    },

    // from derived
    offers,
    storeError,
    storeLoading,
    currentUser,
    canCreateOffers,

    // actions
    initialize,
    loadOffers,
    deleteOffer,
    setFilterType,
    getUserDisplayName
  };
}
