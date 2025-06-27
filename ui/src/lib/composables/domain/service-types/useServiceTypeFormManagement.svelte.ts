import { Effect as E, pipe, Either, Schema } from 'effect';
import type { UIServiceType as UIServiceTypeOriginal } from '$lib/types/ui';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import { ServiceTypeInDHT } from '$lib/schemas/service-types.schemas';
import { ServiceTypesManagementError } from '$lib/errors';
import { runEffect } from '$lib/utils/effect';
import { showToast, sanitizeForSerialization } from '$lib/utils';
import type { Record as HolochainRecord } from '@holochain/client';
import { encodeHashToBase64 } from '@holochain/client';

type UIServiceType = UIServiceTypeOriginal & { actionHash: string };

export function useServiceTypeFormManagement(
  serviceType?: UIServiceTypeOriginal,
  onSubmitSuccess?: (serviceType: UIServiceType) => void,
  onSubmitError?: (error: ServiceTypesManagementError) => void
) {
  const state = $state({
    name: serviceType?.name ?? '',
    description: serviceType?.description ?? '',
    tags: serviceType?.tags ?? ([] as string[]),
    errors: {} as Record<string, string>,
    submissionError: null as string | null,
    isSubmitting: false
  });

  const isValid = $derived(
    state.name.trim() !== '' &&
      state.description.trim() !== '' &&
      Object.keys(state.errors).length === 0
  );

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

    try {
      const record = await runEffect(
        storeMethod(serviceTypeInput).pipe(
          E.mapError((error) =>
            ServiceTypesManagementError.fromError(error, `${action}ServiceType`)
          )
        )
      );

      if (record) {
        const status = action === 'create' ? 'approved' : 'pending';
        const basicUIServiceType: UIServiceType = {
          ...serviceTypeInput,
          actionHash: encodeHashToBase64((record as HolochainRecord).signed_action.hashed.hash),
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
      const serviceTypeError = ServiceTypesManagementError.fromError(error, `${action}ServiceType`);
      state.submissionError = serviceTypeError.message;
      onSubmitError?.(serviceTypeError);
      showToast(`Failed to ${action} service type: ${serviceTypeError.message}`, 'error');
      return null;
    } finally {
      state.isSubmitting = false;
    }
  };

  const createServiceType = () => submit('create');
  const suggestServiceType = () => submit('suggest');

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
    createMockedServiceType,
    suggestServiceType
  };
}
