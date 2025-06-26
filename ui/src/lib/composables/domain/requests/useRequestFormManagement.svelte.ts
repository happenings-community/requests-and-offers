import { Effect as E, pipe, Data } from 'effect';
import type { ActionHash, Record as HcRecord } from '@holochain/client';
import type { UIRequest, UIOrganization } from '$lib/types/ui';
import type { RequestInput, DateRange, TimePreference } from '$lib/types/holochain';
import requestsStore from '$lib/stores/requests.store.svelte';
import organizationsStore from '$lib/stores/organizations.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils';
import {
  ExchangePreference,
  InteractionType,
  ContactPreferenceHelpers,
  TimePreferenceHelpers
} from '$lib/types/holochain';

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

  // Extended form state
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  timeEstimateHours: number | undefined;
  contactPreferenceType: 'Email' | 'Phone' | 'Other';
  contactPreferenceOther: string;
  timePreferenceType: 'Morning' | 'Afternoon' | 'Evening' | 'NoPreference' | 'Other';
  timePreferenceOther: string;
  timeZone: string | undefined;

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

  // Extended form field setters
  setDateRangeStart: (date: string | null) => void;
  setDateRangeEnd: (date: string | null) => void;
  setTimeEstimateHours: (hours: number | undefined) => void;
  setContactPreferenceType: (type: 'Email' | 'Phone' | 'Other') => void;
  setContactPreferenceOther: (value: string) => void;
  setTimePreferenceType: (
    type: 'Morning' | 'Afternoon' | 'Evening' | 'NoPreference' | 'Other'
  ) => void;
  setTimePreferenceOther: (value: string) => void;
  setTimeZone: (tz: string | undefined) => void;

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

    // Extended form state
    dateRangeStart: null,
    dateRangeEnd: null,
    timeEstimateHours: undefined,
    contactPreferenceType: 'Email',
    contactPreferenceOther: '',
    timePreferenceType: 'NoPreference',
    timePreferenceOther: '',
    timeZone: undefined,

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

  $effect(() => {
    const contactPref =
      state.contactPreferenceType === 'Other'
        ? ContactPreferenceHelpers.createOther(state.contactPreferenceOther)
        : state.contactPreferenceType;
    state.contactPreference = contactPref;
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

  // Extended form field setters
  function setDateRangeStart(date: string | null): void {
    state.dateRangeStart = date;
  }

  function setDateRangeEnd(date: string | null): void {
    state.dateRangeEnd = date;
  }

  function setTimeEstimateHours(hours: number | undefined): void {
    state.timeEstimateHours = hours;
  }

  function setContactPreferenceType(type: 'Email' | 'Phone' | 'Other'): void {
    state.contactPreferenceType = type;
  }

  function setContactPreferenceOther(value: string): void {
    state.contactPreferenceOther = value;
  }

  function setTimePreferenceType(
    type: 'Morning' | 'Afternoon' | 'Evening' | 'NoPreference' | 'Other'
  ): void {
    state.timePreferenceType = type;
  }

  function setTimePreferenceOther(value: string): void {
    state.timePreferenceOther = value;
  }

  function setTimeZone(tz: string | undefined): void {
    state.timeZone = tz;
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
    // Basic fields
    state.title = '';
    state.description = '';
    state.serviceTypeHashes = [];
    state.contactPreference = 'Email';
    state.exchangePreference = ExchangePreference.Exchange;
    state.interactionType = InteractionType.Virtual;
    state.links = [];
    state.selectedOrganizationHash = undefined;

    // Extended fields
    state.dateRangeStart = null;
    state.dateRangeEnd = null;
    state.timeEstimateHours = undefined;
    state.contactPreferenceType = 'Email';
    state.contactPreferenceOther = '';
    state.timePreferenceType = 'NoPreference';
    state.timePreferenceOther = '';
    state.timeZone = undefined;

    // Reset errors
    state.errors = {};
    state.submissionError = null;
  }

  // Submit request
  async function submitRequest(): Promise<UIRequest | null> {
    if (!validateForm()) {
      showToast('Please correct the errors before submitting.', 'error');
      return null;
    }

    state.isSubmitting = true;
    state.submissionError = null;

    try {
      // Prepare date range if provided
      let dateRange: DateRange | undefined = undefined;
      if (state.dateRangeStart || state.dateRangeEnd) {
        dateRange = {
          start: state.dateRangeStart ? new Date(state.dateRangeStart).getTime() : null,
          end: state.dateRangeEnd ? new Date(state.dateRangeEnd).getTime() : null
        };
      }

      // Prepare time preference
      const finalTimePreference: TimePreference =
        state.timePreferenceType === 'Other'
          ? TimePreferenceHelpers.createOther(state.timePreferenceOther)
          : state.timePreferenceType;

      const requestInput: RequestInput = {
        title: state.title,
        description: state.description,
        service_type_hashes: [...state.serviceTypeHashes],
        contact_preference: state.contactPreference,
        exchange_preference: state.exchangePreference,
        interaction_type: state.interactionType,
        links: [...state.links],
        date_range: dateRange,
        time_estimate_hours: state.timeEstimateHours,
        time_preference: finalTimePreference,
        time_zone: state.timeZone
      };

      const newRequestRecord = await pipe(
        requestsStore.createRequest(requestInput, state.selectedOrganizationHash),
        runEffect
      );

      state.isSubmitting = false;

      if (newRequestRecord) {
        // Map the record to a UIRequest
        const newRequest: UIRequest = {
          ...requestInput,
          original_action_hash: newRequestRecord.signed_action.hashed.hash,
          previous_action_hash: newRequestRecord.signed_action.hashed.hash,
          creator: newRequestRecord.signed_action.hashed.content.author,
          created_at: newRequestRecord.signed_action.hashed.content.timestamp,
          updated_at: newRequestRecord.signed_action.hashed.content.timestamp,
          organization: state.selectedOrganizationHash
        };

        showToast('Request created successfully!', 'success');
        resetForm();
        onSubmitSuccess?.(newRequest);
        return newRequest;
      }
      return null;
    } catch (e) {
      state.isSubmitting = false;
      const error = RequestFormManagementError.fromError(e, 'Failed to create request');
      state.submissionError = error.message;
      showToast(error.message, 'error');
      onSubmitError?.(error);
      return null;
    }
  }

  // Create mock request
  async function createMockRequest(): Promise<UIRequest | null> {
    if (state.serviceTypeHashes.length === 0) {
      showToast(
        'Please select at least one service type before creating a mocked request',
        'error'
      );
      return null;
    }

    const mockData = {
      title: 'Mock Request: Need help with Svelte 5 migration',
      description:
        'Looking for an experienced developer to help refactor a large Svelte 4 codebase to Svelte 5 using runes. The project is a decentralized application on Holochain.',
      contact_preference: { Other: 'Find me on Discord: @mockdev' },
      exchange_preference: ExchangePreference.Exchange,
      interaction_type: InteractionType.Virtual,
      links: ['https://github.com/h-APP-ening/requests-and-offers'],
      time_estimate_hours: 20
    };

    // Set mock data on the state
    setTitle(mockData.title);
    setDescription(mockData.description);
    setContactPreference(mockData.contact_preference);
    setExchangePreference(mockData.exchange_preference);
    setInteractionType(mockData.interaction_type);
    setLinks(mockData.links);
    setTimeEstimateHours(mockData.time_estimate_hours);

    // Reset some extended fields for clarity
    setDateRangeStart(null);
    setDateRangeEnd(null);
    setTimePreferenceType('NoPreference');
    setTimePreferenceOther('');
    setTimeZone(undefined);
    setContactPreferenceType('Other');
    setContactPreferenceOther('Find me on Discord: @mockdev');

    showToast('Mock request data loaded. Please review and submit.', 'success');

    // We don't submit, just populate the form. Return a resolved promise.
    return Promise.resolve(null);
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

    // Extended state
    get dateRangeStart() {
      return state.dateRangeStart;
    },
    get dateRangeEnd() {
      return state.dateRangeEnd;
    },
    get timeEstimateHours() {
      return state.timeEstimateHours;
    },
    get contactPreferenceType() {
      return state.contactPreferenceType;
    },
    get contactPreferenceOther() {
      return state.contactPreferenceOther;
    },
    get timePreferenceType() {
      return state.timePreferenceType;
    },
    get timePreferenceOther() {
      return state.timePreferenceOther;
    },
    get timeZone() {
      return state.timeZone;
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

    // Extended actions
    setDateRangeStart,
    setDateRangeEnd,
    setTimeEstimateHours,
    setContactPreferenceType,
    setContactPreferenceOther,
    setTimePreferenceType,
    setTimePreferenceOther,
    setTimeZone,

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
