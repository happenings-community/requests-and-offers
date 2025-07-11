import { Effect as E, pipe, Data, Console } from 'effect';
import { page } from '$app/state';
import { goto } from '$app/navigation';
import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
import type { UIServiceType } from '$lib/types/ui';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils';

/**
 * Service Type Details Error
 */
export class ServiceTypeDetailsError extends Data.TaggedError('ServiceTypeDetailsError')<{
  message: string;
  context?: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): ServiceTypeDetailsError {
    if (error instanceof Error) {
      return new ServiceTypeDetailsError({
        message: error.message,
        context,
        cause: error
      });
    }
    return new ServiceTypeDetailsError({
      message: String(error),
      context,
      cause: error
    });
  }
}

/**
 * Service Type Details State
 */
export interface ServiceTypeDetailsState {
  // Core state
  isLoading: boolean;
  error: string | null;
  serviceType: UIServiceType | null;

  // Page context
  serviceTypeId: string | undefined;
}

/**
 * Service Type Details Actions
 */
export interface ServiceTypeDetailsActions {
  // Navigation
  navigateBack: () => void;
  navigateToEdit: () => void;

  // CRUD operations
  deleteServiceType: (confirmer?: () => Promise<boolean>) => Promise<void>;
  refreshData: () => Promise<void>;

  // Utilities
  getEncodedHash: () => string | null;
}

/**
 * Combined interface for the service type details composable
 */
export interface UseServiceTypeDetails extends ServiceTypeDetailsState, ServiceTypeDetailsActions {}

/**
 * Options for the service type details composable
 */
export interface UseServiceTypeDetailsOptions {
  backRoute?: string;
  onDeleted?: () => void;
  onError?: (error: ServiceTypeDetailsError) => void;
}

/**
 * Service Type Details Composable
 */
export function useServiceTypeDetails(
  options: UseServiceTypeDetailsOptions = {}
): UseServiceTypeDetails {
  const { backRoute = '/admin/service-types', onDeleted, onError } = options;

  // Page context
  const serviceTypeId = $derived(page.params.id);

  // Core state
  let state = $state<Omit<ServiceTypeDetailsState, 'serviceTypeId'>>({
    isLoading: true,
    error: null,
    serviceType: null
  });

  // Load service type effect
  const loadServiceTypeEffect = (): E.Effect<UIServiceType | null, ServiceTypeDetailsError> =>
    pipe(
      E.sync(() => {
        if (!serviceTypeId) {
          throw new Error('Invalid service type id');
        }

        try {
          const hash = decodeHashFromBase64(serviceTypeId);

          // Validate hash length - ActionHash should be 39 bytes
          if (hash.length !== 39) {
            throw new Error(`Invalid hash length: expected 39 bytes, got ${hash.length}`);
          }

          // Try to re-encode and decode to validate the hash
          const reEncoded = encodeHashToBase64(hash);
          const reDecoded = decodeHashFromBase64(reEncoded);

          if (!hash.every((byte, index) => byte === reDecoded[index])) {
            throw new Error('Hash encoding/decoding validation failed');
          }

          return hash;
        } catch (error) {
          console.error('Failed to decode hash from base64:', error);
          throw new Error(
            `Invalid service type ID: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }),
      E.flatMap((serviceTypeHash) =>
        pipe(
          serviceTypesStore.getServiceType(serviceTypeHash),
          E.mapError((error) => ServiceTypeDetailsError.fromError(error, 'getServiceType'))
        )
      )
    );

  // Load service type data
  async function loadServiceType(): Promise<void> {
    state.isLoading = true;
    state.error = null;

    try {
      const serviceType = await pipe(loadServiceTypeEffect(), runEffect);

      if (serviceType) {
        state.serviceType = serviceType;
      } else {
        state.error = 'Service type not found';
      }
    } catch (error) {
      const serviceTypeError = ServiceTypeDetailsError.fromError(error, 'loadServiceType');
      state.error = serviceTypeError.message;
      onError?.(serviceTypeError);
      console.error('Failed to load service type:', error);
    } finally {
      state.isLoading = false;
    }
  }

  // Auto-load on mount and when serviceTypeId changes
  $effect(() => {
    if (serviceTypeId) {
      loadServiceType();
    }
  });

  // Navigation functions
  function navigateBack(): void {
    goto(backRoute);
  }

  function navigateToEdit(): void {
    if (state.serviceType?.original_action_hash) {
      const encodedHash = encodeHashToBase64(state.serviceType.original_action_hash);
      goto(`/admin/service-types/${encodedHash}/edit`);
    }
  }

  // Delete with optional confirmation
  async function deleteServiceType(confirmer?: () => Promise<boolean>): Promise<void> {
    if (!state.serviceType?.original_action_hash) {
      showToast('Cannot delete service type: missing action hash', 'error');
      return;
    }

    try {
      // If a confirmer function is provided, use it for confirmation
      if (confirmer) {
        const confirmed = await confirmer();
        if (!confirmed) return;
      }

      const deleteEffect = serviceTypesStore.deleteServiceType(
        state.serviceType.original_action_hash
      );

      runEffect(deleteEffect)
        .then(() => {
          showToast('Service type deleted successfully!', 'success');
          onDeleted?.();
          navigateBack();
        })
        .catch((error) => {
          const deleteError = ServiceTypeDetailsError.fromError(error, 'deleteServiceType');
          showToast(`Failed to delete service type: ${deleteError.message}`, 'error');
          onError?.(deleteError);
        });
    } catch (error) {
      const deleteError = ServiceTypeDetailsError.fromError(error, 'deleteServiceType');
      showToast(`Failed to delete service type: ${deleteError.message}`, 'error');
      onError?.(deleteError);
    }
  }

  // Refresh data
  async function refreshData(): Promise<void> {
    await loadServiceType();
  }

  // Get encoded hash for external use
  function getEncodedHash(): string | null {
    if (!state.serviceType?.original_action_hash) return null;
    return encodeHashToBase64(state.serviceType.original_action_hash);
  }

  return {
    // State getters
    get isLoading() {
      return state.isLoading;
    },
    get error() {
      return state.error;
    },
    get serviceType() {
      return state.serviceType;
    },
    get serviceTypeId() {
      return serviceTypeId;
    },

    // Actions
    navigateBack,
    navigateToEdit,
    deleteServiceType,
    refreshData,
    getEncodedHash
  };
}
