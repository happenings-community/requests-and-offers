import { Effect as E, pipe, Data } from 'effect';
import type { ActionHash, Record as HcRecord } from '@holochain/client';
import type { UIServiceType } from '$lib/types/ui';
import type { ServiceTypeInDHT } from '$lib/types/holochain';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils';

/**
 * Service Type Form Management Error
 */
export class ServiceTypeFormManagementError extends Data.TaggedError(
  'ServiceTypeFormManagementError'
)<{
  message: string;
  context?: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): ServiceTypeFormManagementError {
    if (error instanceof Error) {
      return new ServiceTypeFormManagementError({
        message: error.message,
        context,
        cause: error
      });
    }
    return new ServiceTypeFormManagementError({
      message: String(error),
      context,
      cause: error
    });
  }
}

/**
 * Service Type Form Management State
 */
export interface ServiceTypeFormManagementState {
  // Form data
  name: string;
  description: string;
  tags: string[];

  // Validation state
  isValid: boolean;
  errors: Record<string, string>;

  // Submission state
  isSubmitting: boolean;
  submissionError: string | null;
}

/**
 * Service Type Form Management Actions
 */
export interface ServiceTypeFormManagementActions {
  // Form field setters
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  setTags: (tags: string[]) => void;

  // Convenience methods
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;

  // Form operations
  validateForm: () => boolean;
  resetForm: () => void;

  // Submission actions
  submitServiceType: () => Promise<UIServiceType | null>;
  suggestServiceType: () => Promise<UIServiceType | null>;
  createMockServiceType: () => Promise<UIServiceType | null>;
}

/**
 * Combined interface for the service type form management composable
 */
export interface UseServiceTypeFormManagement
  extends ServiceTypeFormManagementState,
    ServiceTypeFormManagementActions {}

/**
 * Options for the service type form management composable
 */
export interface UseServiceTypeFormOptions {
  onSubmitSuccess?: (serviceType: UIServiceType) => void;
  onSubmitError?: (error: ServiceTypeFormManagementError) => void;
  initialValues?: Partial<ServiceTypeInDHT>;
  mode?: 'create' | 'edit' | 'suggest';
}

/**
 * Service Type Form Management Composable
 *
 * This composable provides:
 * 1. Form state management for service type creation/editing/suggestion
 * 2. Validation and error handling
 * 3. Integration with service types store using Effect patterns
 * 4. Mock service type creation functionality
 *
 * Following the established composable patterns for consistency
 */
export function useServiceTypeFormManagement(
  options: UseServiceTypeFormOptions = {}
): UseServiceTypeFormManagement {
  const { onSubmitSuccess, onSubmitError, initialValues = {}, mode = 'create' } = options;

  // Form state
  let state = $state<ServiceTypeFormManagementState>({
    // Form data
    name: initialValues.name || '',
    description: initialValues.description || '',
    tags: initialValues.tags ? [...initialValues.tags] : [],

    // Validation state
    isValid: false,
    errors: {},

    // Submission state
    isSubmitting: false,
    submissionError: null
  });

  // Computed validation
  const isValid = $derived(
    state.name.trim().length >= 2 &&
      state.name.trim().length <= 100 &&
      state.description.trim().length >= 10 &&
      state.description.trim().length <= 500 &&
      state.tags.length > 0 &&
      state.tags.every((tag) => tag.trim().length >= 1 && tag.trim().length <= 50)
  );

  $effect(() => {
    state.isValid = isValid;
  });

  // Form field setters
  function setName(name: string): void {
    state.name = name;
  }

  function setDescription(description: string): void {
    state.description = description;
  }

  function setTags(tags: string[]): void {
    state.tags = tags;
  }

  // Convenience methods
  function addTag(tag: string): void {
    const trimmedTag = tag.trim();
    if (trimmedTag && !state.tags.includes(trimmedTag)) {
      state.tags = [...state.tags, trimmedTag];
    }
  }

  function removeTag(tag: string): void {
    state.tags = state.tags.filter((t) => t !== tag);
  }

  // Form operations
  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!state.name.trim()) {
      errors.name = 'Name is required';
    } else if (state.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    } else if (state.name.trim().length > 100) {
      errors.name = 'Name must be 100 characters or less';
    }

    if (!state.description.trim()) {
      errors.description = 'Description is required';
    } else if (state.description.trim().length < 10) {
      errors.description = 'Description must be at least 10 characters';
    } else if (state.description.trim().length > 500) {
      errors.description = 'Description must be 500 characters or less';
    }

    if (state.tags.length === 0) {
      errors.tags = 'At least one tag is required';
    } else {
      const invalidTags = state.tags.filter(
        (tag) => tag.trim().length < 1 || tag.trim().length > 50
      );
      if (invalidTags.length > 0) {
        errors.tags = 'Tags must be between 1 and 50 characters';
      }
    }

    state.errors = errors;
    return Object.keys(errors).length === 0;
  }

  function resetForm(): void {
    state.name = '';
    state.description = '';
    state.tags = [];
    state.errors = {};
  }

  // Submit service type (create or edit)
  async function submitServiceType(): Promise<UIServiceType | null> {
    // Validate form first
    if (!validateForm()) {
      state.submissionError = 'Please fix form errors before submitting';
      return null;
    }

    state.isSubmitting = true;
    state.submissionError = null;

    try {
      // Build the ServiceTypeInDHT
      const serviceTypeInput: ServiceTypeInDHT = {
        name: state.name.trim(),
        description: state.description.trim(),
        tags: state.tags.map((tag) => tag.trim())
      };

      // Submit to the store - createServiceType returns a HcRecord, not UIServiceType
      const record = await pipe(
        serviceTypesStore.createServiceType(serviceTypeInput),
        E.mapError((error) => ServiceTypeFormManagementError.fromError(error, 'createServiceType')),
        runEffect
      );

      if (record) {
        // Reset form on success
        resetForm();

        // Create a basic UIServiceType representation for the callback
        // Note: The store will handle proper UI conversion and caching
        const basicUIServiceType: UIServiceType = {
          ...serviceTypeInput,
          original_action_hash: record.signed_action.hashed.hash,
          previous_action_hash: record.signed_action.hashed.hash,
          creator: record.signed_action.hashed.content.author,
          created_at: record.signed_action.hashed.content.timestamp,
          updated_at: record.signed_action.hashed.content.timestamp,
          status: 'approved' as const
        };

        onSubmitSuccess?.(basicUIServiceType);
        pipe(showToast('Service type created successfully!', 'success'), runEffect);
        return basicUIServiceType;
      }

      return null;
    } catch (error) {
      const serviceTypeError = ServiceTypeFormManagementError.fromError(error, 'submitServiceType');
      state.submissionError = serviceTypeError.message;
      onSubmitError?.(serviceTypeError);
      pipe(
        showToast(`Failed to create service type: ${serviceTypeError.message}`, 'error'),
        runEffect
      );
      return null;
    } finally {
      state.isSubmitting = false;
    }
  }

  // Suggest service type
  async function suggestServiceType(): Promise<UIServiceType | null> {
    // Validate form first
    if (!validateForm()) {
      state.submissionError = 'Please fix form errors before submitting';
      return null;
    }

    state.isSubmitting = true;
    state.submissionError = null;

    try {
      // Build the ServiceTypeInDHT
      const serviceTypeInput: ServiceTypeInDHT = {
        name: state.name.trim(),
        description: state.description.trim(),
        tags: state.tags.map((tag) => tag.trim())
      };

      // Submit suggestion to the store
      const record = await pipe(
        serviceTypesStore.suggestServiceType(serviceTypeInput),
        E.mapError((error) =>
          ServiceTypeFormManagementError.fromError(error, 'suggestServiceType')
        ),
        runEffect
      );

      if (record) {
        // Reset form on success
        resetForm();

        // Create a basic UIServiceType representation for the callback
        const basicUIServiceType: UIServiceType = {
          ...serviceTypeInput,
          original_action_hash: record.signed_action.hashed.hash,
          previous_action_hash: record.signed_action.hashed.hash,
          creator: record.signed_action.hashed.content.author,
          created_at: record.signed_action.hashed.content.timestamp,
          updated_at: record.signed_action.hashed.content.timestamp,
          status: 'pending' as const
        };

        onSubmitSuccess?.(basicUIServiceType);
        pipe(
          showToast(
            `Successfully suggested "${state.name.trim()}". It is now pending review.`,
            'success'
          ),
          runEffect
        );
        return basicUIServiceType;
      }

      return null;
    } catch (error) {
      const serviceTypeError = ServiceTypeFormManagementError.fromError(
        error,
        'suggestServiceType'
      );
      state.submissionError = serviceTypeError.message;
      onSubmitError?.(serviceTypeError);
      pipe(
        showToast(`Failed to suggest service type: ${serviceTypeError.message}`, 'error'),
        runEffect
      );
      return null;
    } finally {
      state.isSubmitting = false;
    }
  }

  // Create mock service type
  async function createMockServiceType(): Promise<UIServiceType | null> {
    try {
      // Import dynamically to avoid circular dependencies
      const { createSuggestedMockedServiceType } = await import('$lib/utils/mocks');
      const mockedServiceType = createSuggestedMockedServiceType();

      // Update form with mock data
      state.name = mockedServiceType.name;
      state.description = mockedServiceType.description;
      state.tags = [...mockedServiceType.tags];

      // Submit the mocked service type based on current mode
      if (mode === 'suggest') {
        return await suggestServiceType();
      } else {
        return await submitServiceType();
      }
    } catch (error) {
      pipe(showToast(`Error creating mocked service type: ${error}`, 'error'), runEffect);
      return null;
    }
  }

  return {
    // Form data getters
    get name() {
      return state.name;
    },
    get description() {
      return state.description;
    },
    get tags() {
      return state.tags;
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
    setName,
    setDescription,
    setTags,

    // Convenience methods
    addTag,
    removeTag,

    // Form operations
    validateForm,
    resetForm,

    // Submission actions
    submitServiceType,
    suggestServiceType,
    createMockServiceType
  };
}
