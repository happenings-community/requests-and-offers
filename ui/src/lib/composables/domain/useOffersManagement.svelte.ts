import type { ActionHash } from '@holochain/client';
import type { UIOffer, BaseComposableState, UIUser } from '$lib/types/ui';
import type { BaseComposableError } from '$lib/types/error';
import offersStore from '$lib/stores/offers.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils';
import { useModal } from '$lib/utils/composables';
import { Effect as E, Data, pipe } from 'effect';

// Typed error for the composable
export class OffersManagementError extends Data.TaggedError('OffersManagementError')<{
  message: string;
  context?: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): OffersManagementError {
    if (error instanceof Error) {
      return new OffersManagementError({
        message: error.message,
        context,
        cause: error
      });
    }
    return new OffersManagementError({
      message: String(error),
      context,
      cause: error
    });
  }
}

export interface OffersManagementState extends BaseComposableState {
  filteredOffers: UIOffer[];
  filterType: 'all' | 'my' | 'organization';
  hasInitialized: boolean;
}

export interface OffersManagementActions {
  initialize: () => Promise<void>;
  loadOffers: () => Promise<void>;
  deleteOffer: (offerHash: ActionHash) => void;
  setFilterType: (filterType: 'all' | 'my' | 'organization') => void;
  getUserDisplayName: (user: UIUser | null) => string;
}

export interface UseOffersManagement extends OffersManagementState, OffersManagementActions {
  offers: readonly UIOffer[];
  filteredOffers: UIOffer[];
  storeError: string | null;
  storeLoading: boolean;
  currentUser: UIUser | null;
  canCreateOffers: boolean;
}

export function useOffersManagement(): UseOffersManagement {
  const modal = useModal();

  // State
  let state = $state<OffersManagementState>({
    isLoading: true,
    error: null,
    filteredOffers: [],
    filterType: 'all',
    hasInitialized: false
  });

  // Reactive getters from stores
  const { offers, loading: storeLoading, error: storeError } = $derived(offersStore);
  const { currentUser } = $derived(usersStore);

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
  const loadOffersEffect = (): E.Effect<void, OffersManagementError> =>
    pipe(
      E.sync(() => {
        state.isLoading = true;
        state.error = null;
      }),
      E.flatMap(() =>
        pipe(
          offersStore.getAllOffers(),
          E.mapError((error) => OffersManagementError.fromError(error, 'getAllOffers'))
        )
      ),
      E.tap(() => {
        state.hasInitialized = true;
      }),
      E.asVoid,
      E.catchAll((error) => E.fail(OffersManagementError.fromError(error, 'loadOffers'))),
      E.ensuring(
        E.sync(() => {
          state.isLoading = false;
        })
      )
    );

  // Load offers from the store
  async function loadOffers(): Promise<void> {
    return pipe(
      loadOffersEffect(),
      E.catchAll((error) =>
        pipe(
          showToast('Failed to load offers', 'error'),
          E.flatMap(() => {
            state.error = error.message;
            return E.fail(error);
          })
        )
      ),
      E.orElse(() => E.void),
      runEffect
    );
  }

  // Load initial data using Effect composition
  const initializeEffect = (): E.Effect<void, OffersManagementError> =>
    pipe(
      loadOffersEffect(),
      E.flatMap(() =>
        pipe(
          // Also refresh current user to ensure data is up-to-date
          E.tryPromise({
            try: () => usersStore.refreshCurrentUser(),
            catch: (error) => error
          }),
          E.catchAll((error) => {
            console.warn('Failed to refresh current user:', error);
            return E.void;
          })
        )
      )
    );

  async function initialize(): Promise<void> {
    return runEffect(initializeEffect());
  }

  // Delete an offer with confirmation using Effect composition
  const deleteOfferEffect = (offerHash: ActionHash): E.Effect<void, OffersManagementError> =>
    pipe(
      E.tryPromise({
        try: () =>
          modal.confirm(
            'Are you sure you want to delete this offer?<br/>This action cannot be undone.',
            { confirmLabel: 'Delete', cancelLabel: 'Cancel' }
          ),
        catch: (error) => OffersManagementError.fromError(error, 'confirmDialog')
      }),
      E.flatMap((confirmed) => {
        if (!confirmed) return E.void;

        return pipe(
          E.tryPromise({
            try: () => runEffect(offersStore.deleteOffer(offerHash)),
            catch: (error) => OffersManagementError.fromError(error, 'deleteOffer')
          }),
          E.flatMap(() => loadOffersEffect()),
          E.flatMap(() => showToast('Offer deleted successfully'))
        );
      }),
      E.catchAll((error) =>
        pipe(
          showToast(`Failed to delete offer: ${error}`, 'error'),
          E.flatMap(() => E.fail(OffersManagementError.fromError(error, 'deleteOffer')))
        )
      )
    );

  function deleteOffer(offerHash: ActionHash): void {
    runEffect(deleteOfferEffect(offerHash));
  }

  // Set filter type
  function setFilterType(filterType: 'all' | 'my' | 'organization'): void {
    state.filterType = filterType;
  }

  // Get user display name helper
  function getUserDisplayName(user: UIUser | null): string {
    if (!user) return 'Anonymous';
    return user.nickname || 'Anonymous';
  }

  // Check if user can create offers
  const canCreateOffers = $derived(currentUser?.status?.status_type === 'accepted');

  // Return composable interface
  return {
    ...state,
    offers,
    filteredOffers,
    storeError,
    storeLoading,
    currentUser,
    canCreateOffers,

    // Actions
    initialize,
    loadOffers,
    deleteOffer,
    setFilterType,
    getUserDisplayName
  };
}
