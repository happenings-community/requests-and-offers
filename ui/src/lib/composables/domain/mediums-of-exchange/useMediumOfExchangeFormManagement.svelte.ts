import { Effect as E, pipe, Either, Schema } from 'effect';
import type { UIMediumOfExchange as UIMediumOfExchangeOriginal } from '$lib/schemas/mediums-of-exchange.schemas';
import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
import {
  type MediumOfExchangeInDHT,
  MediumOfExchangeInDHTSchema
} from '$lib/schemas/mediums-of-exchange.schemas';
import { MediumOfExchangeStoreError } from '$lib/stores/mediums_of_exchange.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils';
import type { Record as HolochainRecord, ActionHash } from '@holochain/client';

// Extend the original type with the properties needed for editing
type UIMediumOfExchange = UIMediumOfExchangeOriginal & {
  previous_action_hash?: ActionHash;
};

export function useMediumOfExchangeFormManagement(
  mediumOfExchange?: UIMediumOfExchange,
  onSubmitSuccess?: (mediumOfExchange: UIMediumOfExchange) => void,
  onSubmitError?: (error: MediumOfExchangeStoreError) => void
) {
  const state = $state({
    code: mediumOfExchange?.code ?? '',
    name: mediumOfExchange?.name ?? '',
    description: mediumOfExchange?.description ?? '',
    errors: {} as Record<string, string>,
    submissionError: null as string | null,
    isSubmitting: false
  });

  const isValid = $derived(
    state.code.trim() !== '' && state.name.trim() !== '' && Object.keys(state.errors).length === 0
  );

  const validate = () => {
    const result = Schema.decodeUnknownEither(MediumOfExchangeInDHTSchema)({
      code: state.code,
      name: state.name,
      description: state.description || null
    });

    if (Either.isLeft(result)) {
      const error = result.left;
      state.errors = { form: error._tag };
      return false;
    }
    state.errors = {};
    return true;
  };

  const resetForm = () => {
    state.code = '';
    state.name = '';
    state.errors = {};
    state.submissionError = null;
  };

  const submit = async (action: 'create' | 'suggest') => {
    if (!validate()) {
      return null;
    }
    state.isSubmitting = true;

    // Sanitize form data to remove proxy wrappers before sending to backend
    const mediumOfExchangeInput = {
      code: state.code.trim(),
      name: state.name.trim(),
      description: state.description.trim() || null
    };

    const storeMethod =
      action === 'create'
        ? mediumsOfExchangeStore.suggestMediumOfExchange // Admin creates are auto-approved via suggest
        : mediumsOfExchangeStore.suggestMediumOfExchange;

    try {
      const record = await runEffect(
        storeMethod(mediumOfExchangeInput).pipe(
          E.mapError((error) =>
            MediumOfExchangeStoreError.fromError(error, `${action}MediumOfExchange`)
          )
        )
      );

      if (record) {
        const status = action === 'create' ? 'approved' : 'pending';
        const basicUIMediumOfExchange: UIMediumOfExchange = {
          ...mediumOfExchangeInput,
          actionHash: (record as HolochainRecord).signed_action.hashed.hash,
          original_action_hash: (record as HolochainRecord).signed_action.hashed.hash,
          resourceSpecHreaId: null,
          status,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        onSubmitSuccess?.(basicUIMediumOfExchange);
        const successMessage =
          action === 'create'
            ? 'Medium of exchange created successfully!'
            : `Successfully suggested "${state.name}". It is now pending review.`;
        showToast(successMessage, 'success');
        resetForm();
        return basicUIMediumOfExchange;
      }
      return null;
    } catch (error) {
      const mediumOfExchangeError = MediumOfExchangeStoreError.fromError(
        error,
        `${action}MediumOfExchange`
      );
      state.submissionError = mediumOfExchangeError.message;
      onSubmitError?.(mediumOfExchangeError);
      showToast(
        `Failed to ${action} medium of exchange: ${mediumOfExchangeError.message}`,
        'error'
      );
      return null;
    } finally {
      state.isSubmitting = false;
    }
  };

  const update = async () => {
    if (
      !validate() ||
      !mediumOfExchange?.original_action_hash ||
      !mediumOfExchange?.previous_action_hash
    ) {
      state.submissionError = 'Missing original or previous action hash for updating.';
      showToast(state.submissionError, 'error');
      return null;
    }
    state.isSubmitting = true;

    const updatedMediumOfExchange = {
      code: state.code.trim(),
      name: state.name.trim()
    };

    try {
      const record = await runEffect(
        mediumsOfExchangeStore.updateMediumOfExchange(
          mediumOfExchange.original_action_hash,
          mediumOfExchange.previous_action_hash,
          updatedMediumOfExchange
        )
      );

      if (record) {
        const uiMediumOfExchange: UIMediumOfExchange = {
          ...updatedMediumOfExchange,
          actionHash: (record as HolochainRecord).signed_action.hashed.hash,
          original_action_hash: (record as HolochainRecord).signed_action.hashed.hash,
          previous_action_hash: (record as HolochainRecord).signed_action.hashed.hash,
          resourceSpecHreaId: mediumOfExchange.resourceSpecHreaId,
          status: mediumOfExchange.status,
          createdAt: mediumOfExchange.createdAt,
          updatedAt: new Date()
        };

        onSubmitSuccess?.(uiMediumOfExchange);
        showToast('Medium of exchange updated successfully!', 'success');
        return uiMediumOfExchange;
      }
      return null;
    } catch (error) {
      const mediumOfExchangeError = MediumOfExchangeStoreError.fromError(
        error,
        `updateMediumOfExchange`
      );
      state.submissionError = mediumOfExchangeError.message;
      onSubmitError?.(mediumOfExchangeError);
      showToast(`Failed to update medium of exchange: ${mediumOfExchangeError.message}`, 'error');
      return null;
    } finally {
      state.isSubmitting = false;
    }
  };

  const createMediumOfExchange = () => submit('create');
  const suggestMediumOfExchange = () => submit('suggest');
  const updateMediumOfExchange = () => update();

  return {
    state,
    isValid,
    resetForm,
    createMediumOfExchange,
    updateMediumOfExchange,
    suggestMediumOfExchange
  };
}
