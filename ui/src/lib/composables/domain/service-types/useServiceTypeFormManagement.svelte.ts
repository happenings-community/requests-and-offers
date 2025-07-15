import { Effect as E, pipe, Either, Schema } from 'effect';
import type { UIServiceType } from '$lib/types/ui';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import {
  ServiceTypeInDHT,
  UpdateServiceTypeInput,
  UpdateServiceTypeInputSchema
} from '$lib/schemas/service-types.schemas';
import { ServiceTypeError, SERVICE_TYPE_CONTEXTS } from '$lib/errors';
import { runEffect } from '$lib/utils/effect';
import { showToast, sanitizeForSerialization } from '$lib/utils';
import type { Record as HolochainRecord } from '@holochain/client';
import { encodeHashToBase64 } from '@holochain/client';

export function useServiceTypeFormManagement(
  serviceType?: UIServiceType,
  onSubmitSuccess?: (serviceType: UIServiceType) => void,
  onSubmitError?: (error: ServiceTypeError) => void
) {
  const isUpdate = $derived(!!serviceType?.original_action_hash);

  const state = $state({
    name: serviceType?.name ?? '',
    description: serviceType?.description ?? '',
    tags: serviceType?.tags ?? ([] as string[]),
    errors: {} as Record<string, string>,
    submissionError: null as string | null,
    isSubmitting: false
  });

  // Real-time validation that runs whenever form fields change
  const isValid = $derived(() => {
    // Reset errors for real-time validation
    const errors: Record<string, string> = {};

    // Validate required fields
    if (state.name.trim() === '') {
      errors.name = 'Name is required';
    }

    if (state.description.trim() === '') {
      errors.description = 'Description is required';
    }

    // Validate with schema
    const result = Schema.decodeUnknownEither(ServiceTypeInDHT)({
      name: state.name,
      description: state.description,
      tags: state.tags
    });

    if (Either.isLeft(result)) {
      errors.form = 'Invalid service type data';
    }

    // Update errors state
    state.errors = errors;

    // Form is valid if no errors and required fields are filled
    return (
      state.name.trim() !== '' &&
      state.description.trim() !== '' &&
      Object.keys(errors).length === 0
    );
  });

  const validate = () => {
    const result = Schema.decodeUnknownEither(ServiceTypeInDHT)({
      name: state.name,
      description: state.description,
      tags: state.tags
    });

    if (Either.isLeft(result)) {
      const error = result.left;
      // A more sophisticated error mapping could be done here
      state.errors = { form: error._tag };
      return false;
    }
    state.errors = {};
    return true;
  };

  const resetForm = () => {
    state.name = '';
    state.description = '';
    state.tags = [];
    state.errors = {};
    state.submissionError = null;
  };

  const submit = async (action: 'create' | 'suggest') => {
    if (!validate()) {
      return null;
    }
    state.isSubmitting = true;

    // Sanitize form data to remove proxy wrappers before sending to backend
    const serviceTypeInput = {
      name: state.name.trim(),
      description: state.description.trim(),
      tags: [...state.tags] // Spread operator removes proxy wrapper from array
    };

    const storeMethod =
      action === 'create'
        ? serviceTypesStore.createServiceType
        : serviceTypesStore.suggestServiceType;

    const context =
      action === 'create'
        ? SERVICE_TYPE_CONTEXTS.CREATE_SERVICE_TYPE
        : SERVICE_TYPE_CONTEXTS.SUGGEST_SERVICE_TYPE;

    try {
      const record = await runEffect(
        storeMethod(serviceTypeInput).pipe(
          E.mapError((error) => ServiceTypeError.fromError(error, context))
        )
      );

      if (record) {
        const status = action === 'create' ? 'approved' : 'pending';
        const basicUIServiceType: UIServiceType = {
          ...serviceTypeInput,
          original_action_hash: (record as HolochainRecord).signed_action.hashed.hash,
          status
        };
        onSubmitSuccess?.(basicUIServiceType);
        const successMessage =
          action === 'create'
            ? 'Service type created successfully!'
            : `Successfully suggested "${state.name}". It is now pending review.`;
        showToast(successMessage, 'success');
        resetForm();
        return basicUIServiceType;
      }
      return null;
    } catch (error) {
      const serviceTypeError = ServiceTypeError.fromError(error, context);
      state.submissionError = serviceTypeError.message;
      onSubmitError?.(serviceTypeError);
      showToast(`Failed to ${action} service type: ${serviceTypeError.message}`, 'error');
      return null;
    } finally {
      state.isSubmitting = false;
    }
  };

  const update = async () => {
    if (!validate() || !serviceType?.original_action_hash || !serviceType?.previous_action_hash) {
      // This case should ideally be handled more gracefully
      state.submissionError = 'Missing original or previous action hash for updating.';
      showToast(state.submissionError, 'error');
      return null;
    }
    state.isSubmitting = true;

    const updatedServiceType = {
      name: state.name.trim(),
      description: state.description.trim(),
      tags: [...state.tags]
    };

    const input = {
      original_action_hash: serviceType.original_action_hash,
      previous_action_hash: serviceType.previous_action_hash,
      updated_service_type: updatedServiceType
    };

    const validationResult = Schema.decodeUnknownEither(UpdateServiceTypeInput)(input);

    if (Either.isLeft(validationResult)) {
      state.submissionError = 'Invalid data for updating service type.';
      showToast(state.submissionError, 'error');
      state.isSubmitting = false;
      return null;
    }

    try {
      const record = await runEffect(
        serviceTypesStore.updateServiceType(
          validationResult.right.original_action_hash,
          validationResult.right.previous_action_hash,
          validationResult.right.updated_service_type
        )
      );

      if (record) {
        const uiServiceType: UIServiceType = {
          ...updatedServiceType,
          original_action_hash: (record as HolochainRecord).signed_action.hashed.hash,
          status: serviceType.status
        };

        onSubmitSuccess?.(uiServiceType);
        showToast('Service type updated successfully!', 'success');
        return uiServiceType;
      }
      return null;
    } catch (error) {
      const serviceTypeError = ServiceTypeError.fromError(
        error,
        SERVICE_TYPE_CONTEXTS.UPDATE_SERVICE_TYPE
      );
      state.submissionError = serviceTypeError.message;
      onSubmitError?.(serviceTypeError);
      showToast(`Failed to update service type: ${serviceTypeError.message}`, 'error');
      return null;
    } finally {
      state.isSubmitting = false;
    }
  };

  const createServiceType = () => submit('create');
  const suggestServiceType = () => submit('suggest');
  const updateServiceType = () => update();

  const createMockedServiceType = async (serviceTypeData: UIServiceType) => {
    state.name = serviceTypeData.name;
    state.description = serviceTypeData.description;
    state.tags = serviceTypeData.tags;
    await suggestServiceType();
  };

  return {
    state,
    isValid,
    resetForm,
    createServiceType,
    updateServiceType,
    createMockedServiceType,
    suggestServiceType
  };
}
