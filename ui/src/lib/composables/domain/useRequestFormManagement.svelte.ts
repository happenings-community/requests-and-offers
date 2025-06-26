import { Effect as E, pipe, Data } from 'effect';
import type { ActionHash, Record as HcRecord } from '@holochain/client';
import type { UIRequest, UIOrganization } from '$lib/types/ui';
import type { RequestInput } from '$lib/types/holochain';
import requestsStore from '$lib/stores/requests.store.svelte';
import organizationsStore from '$lib/stores/organizations.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils';
import { ExchangePreference, InteractionType } from '$lib/types/holochain';

/**
 * Request Form Management Error
 */
export class RequestFormManagementError extends Data.TaggedError('RequestFormManagementError')<{
  message: string;
  context?: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): RequestFormManagementError {
    if (error instanceof Error) {
      return new RequestFormManagementError({
        message: error.message,
        context,
        cause: error
      });
    }
    return new RequestFormManagementError({
      message: String(error),
      context,
      cause: error
    });
  }
}

/**
 * Request Form Management State
 */
export interface RequestFormManagementState {
  // Form data
  title: string;
  description: string;
  serviceTypeHashes: ActionHash[];
  contactPreference: 'Email' | 'Phone' | { Other: string };
  exchangePreference: ExchangePreference;
  interactionType: InteractionType;
  links: string[];
  selectedOrganizationHash?: ActionHash;

  // Organization management
  userCoordinatedOrganizations: UIOrganization[];
  isLoadingOrganizations: boolean;
  organizationsError: string | null;

  // Validation state
  isValid: boolean;
  errors: Record<string, string>;

  // Submission state
  isSubmitting: boolean;
  submissionError: string | null;
}

/**
 * Request Form Management Actions
 */
export interface RequestFormManagementActions {
  // Form field setters
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setServiceTypeHashes: (hashes: ActionHash[]) => void;
  setContactPreference: (pref: 'Email' | 'Phone' | { Other: string }) => void;
  setExchangePreference: (pref: ExchangePreference) => void;
  setInteractionType: (type: InteractionType) => void;
  setLinks: (links: string[]) => void;
  setSelectedOrganization: (hash?: ActionHash) => void;

  // Convenience methods
  addServiceType: (hash: ActionHash) => void;
  removeServiceType: (hash: ActionHash) => void;

  // Organization actions
  loadUserOrganizations: () => Promise<void>;

  // Form operations
  validateForm: () => boolean;
  resetForm: () => void;

  // Submission actions
  submitRequest: () => Promise<UIRequest | null>;
  createMockRequest: () => Promise<UIRequest | null>;
}

/**
 * Combined interface for the request form management composable
 */
export interface UseRequestFormManagement
  extends RequestFormManagementState,
    RequestFormManagementActions {}

/**
 * Options for the request form management composable
 */
export interface UseRequestFormOptions {
  onSubmitSuccess?: (request: UIRequest) => void;
  onSubmitError?: (error: RequestFormManagementError) => void;
  autoLoadOrganizations?: boolean;
  initialValues?: Partial<RequestInput>;
}

/**
 * Request Form Management Composable
 *
 * This composable combines:
 * 1. Generic form validation (via useFormValidation)
 * 2. Request-specific business logic (organizations, submission)
 * 3. Clean interface for request forms
 *
 * Following the composable patterns for proper layering and separation of concerns
 */
export function useRequestFormManagement(
  options: UseRequestFormOptions = {}
): UseRequestFormManagement {
  const {
    onSubmitSuccess,
    onSubmitError,
    autoLoadOrganizations = true,
    initialValues = {}
  } = options;

  // Form state
  let state = $state<RequestFormManagementState>({
    // Form data
    title: initialValues.title || '',
    description: initialValues.description || '',
    serviceTypeHashes: initialValues.service_type_hashes || [],
    contactPreference: initialValues.contact_preference || 'Email',
    exchangePreference: initialValues.exchange_preference || ExchangePreference.Exchange,
    interactionType: initialValues.interaction_type || InteractionType.Virtual,
    links: initialValues.links || [],
    selectedOrganizationHash: undefined,

    // Organization management
    userCoordinatedOrganizations: [],
    isLoadingOrganizations: false,
    organizationsError: null,

    // Validation state
    isValid: false,
    errors: {},

    // Submission state
    isSubmitting: false,
    submissionError: null
  });

  // Computed validation
  const isValid = $derived(
    state.title.trim().length > 0 &&
      state.description.trim().length > 0 &&
      state.serviceTypeHashes.length > 0
  );

  $effect(() => {
    state.isValid = isValid;
  });

  // Auto-load organizations when user is available
  $effect(() => {
    if (autoLoadOrganizations && usersStore.currentUser?.original_action_hash) {
      loadUserOrganizations();
    }
  });

  // Organization management
  async function loadUserOrganizations(): Promise<void> {
    if (!usersStore.currentUser?.original_action_hash) return;

    state.isLoadingOrganizations = true;
    state.organizationsError = null;

    try {
      const orgs = await organizationsStore.getUserCoordinatedOrganizations(
        usersStore.currentUser.original_action_hash
      );
      state.userCoordinatedOrganizations = orgs.filter(
        (org) => org.status?.status_type === 'accepted'
      );
    } catch (error) {
      state.organizationsError =
        error instanceof Error ? error.message : 'Failed to load organizations';
      state.userCoordinatedOrganizations = [];
    } finally {
      state.isLoadingOrganizations = false;
    }
  }

  // Form field setters
  function setTitle(title: string): void {
    state.title = title;
  }

  function setDescription(description: string): void {
    state.description = description;
  }

  function setServiceTypeHashes(hashes: ActionHash[]): void {
    state.serviceTypeHashes = hashes;
  }

  function setContactPreference(pref: 'Email' | 'Phone' | { Other: string }): void {
    state.contactPreference = pref;
  }

  function setExchangePreference(pref: ExchangePreference): void {
    state.exchangePreference = pref;
  }

  function setInteractionType(type: InteractionType): void {
    state.interactionType = type;
  }

  function setLinks(links: string[]): void {
    state.links = links;
  }

  function setSelectedOrganization(hash?: ActionHash): void {
    state.selectedOrganizationHash = hash;
  }

  // Convenience methods
  function addServiceType(hash: ActionHash): void {
    if (!state.serviceTypeHashes.includes(hash)) {
      state.serviceTypeHashes = [...state.serviceTypeHashes, hash];
    }
  }

  function removeServiceType(hash: ActionHash): void {
    state.serviceTypeHashes = state.serviceTypeHashes.filter((h) => h !== hash);
  }

  // Form operations
  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!state.title.trim()) {
      errors.title = 'Title is required';
    }

    if (!state.description.trim()) {
      errors.description = 'Description is required';
    }

    if (state.serviceTypeHashes.length === 0) {
      errors.serviceTypeHashes = 'At least one service type is required';
    }

    state.errors = errors;
    return Object.keys(errors).length === 0;
  }

  function resetForm(): void {
    state.title = '';
    state.description = '';
    state.serviceTypeHashes = [];
    state.contactPreference = 'Email';
    state.exchangePreference = ExchangePreference.Exchange;
    state.interactionType = InteractionType.Virtual;
    state.links = [];
    state.selectedOrganizationHash = undefined;
    state.errors = {};
  }

  // Submit request
  async function submitRequest(): Promise<UIRequest | null> {
    // Validate form first
    if (!validateForm()) {
      state.submissionError = 'Please fix form errors before submitting';
      return null;
    }

    state.isSubmitting = true;
    state.submissionError = null;

    try {
      // Build the RequestInput
      const requestInput: RequestInput = {
        title: state.title,
        description: state.description,
        service_type_hashes: state.serviceTypeHashes,
        contact_preference: state.contactPreference,
        time_preference: 'NoPreference', // Default value
        exchange_preference: state.exchangePreference,
        interaction_type: state.interactionType,
        links: state.links
      };

      // Submit to the store - createRequest returns a HcRecord, not UIRequest
      const record = await pipe(
        requestsStore.createRequest(requestInput, state.selectedOrganizationHash),
        E.mapError((error) => RequestFormManagementError.fromError(error, 'createRequest')),
        runEffect
      );

      if (record) {
        // Reset form on success
        resetForm();

        // Create a basic UIRequest representation for the callback
        // Note: The store will handle proper UI conversion and caching
        const basicUIRequest: UIRequest = {
          ...requestInput,
          original_action_hash: record.signed_action.hashed.hash,
          previous_action_hash: record.signed_action.hashed.hash,
          creator: record.signed_action.hashed.content.author,
          organization: state.selectedOrganizationHash,
          created_at: record.signed_action.hashed.content.timestamp,
          updated_at: record.signed_action.hashed.content.timestamp,
          service_type_hashes: state.serviceTypeHashes
        };

        onSubmitSuccess?.(basicUIRequest);
        pipe(showToast('Request created successfully!', 'success'), runEffect);
        return basicUIRequest;
      }

      return null;
    } catch (error) {
      const requestError = RequestFormManagementError.fromError(error, 'submitRequest');
      state.submissionError = requestError.message;
      onSubmitError?.(requestError);
      pipe(showToast(`Failed to create request: ${requestError.message}`, 'error'), runEffect);
      return null;
    } finally {
      state.isSubmitting = false;
    }
  }

  // Create mock request
  async function createMockRequest(): Promise<UIRequest | null> {
    if (state.serviceTypeHashes.length === 0) {
      pipe(
        showToast(
          'Please select at least one service type before creating a mocked request',
          'error'
        ),
        runEffect
      );
      return null;
    }

    try {
      // Import dynamically to avoid circular dependencies
      const { createMockedRequests } = await import('$lib/utils/mocks');
      const mockedRequest = (await createMockedRequests())[0];

      // Update form with mock data
      state.title = mockedRequest.title;
      state.description = mockedRequest.description;
      state.contactPreference = mockedRequest.contact_preference;
      state.exchangePreference = mockedRequest.exchange_preference;
      state.interactionType = mockedRequest.interaction_type;
      state.links = mockedRequest.links;
      // Keep the selected service types

      // Submit the mocked request
      return await submitRequest();
    } catch (error) {
      pipe(showToast(`Error creating mocked request: ${error}`, 'error'), runEffect);
      return null;
    }
  }

  return {
    // Form data getters
    get title() {
      return state.title;
    },
    get description() {
      return state.description;
    },
    get serviceTypeHashes() {
      return state.serviceTypeHashes;
    },
    get contactPreference() {
      return state.contactPreference;
    },
    get exchangePreference() {
      return state.exchangePreference;
    },
    get interactionType() {
      return state.interactionType;
    },
    get links() {
      return state.links;
    },
    get selectedOrganizationHash() {
      return state.selectedOrganizationHash;
    },

    // Organization state
    get userCoordinatedOrganizations() {
      return state.userCoordinatedOrganizations;
    },
    get isLoadingOrganizations() {
      return state.isLoadingOrganizations;
    },
    get organizationsError() {
      return state.organizationsError;
    },

    // Validation state
    get isValid() {
      return state.isValid;
    },
    get errors() {
      return state.errors;
    },

    // Submission state
    get isSubmitting() {
      return state.isSubmitting;
    },
    get submissionError() {
      return state.submissionError;
    },

    // Form field setters
    setTitle,
    setDescription,
    setServiceTypeHashes,
    setContactPreference,
    setExchangePreference,
    setInteractionType,
    setLinks,
    setSelectedOrganization,

    // Convenience methods
    addServiceType,
    removeServiceType,

    // Organization actions
    loadUserOrganizations,

    // Form operations
    validateForm,
    resetForm,

    // Submission actions
    submitRequest,
    createMockRequest
  };
}
