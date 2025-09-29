import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { Effect as E, Layer, Context } from 'effect';
import { MediumOfExchangeError } from '$lib/errors/mediums-of-exchange.errors';
import { MEDIUM_OF_EXCHANGE_CONTEXTS } from '$lib/errors/error-contexts';
import { wrapZomeCallWithErrorFactory } from '$lib/utils/zome-helpers';

// Re-export MediumOfExchangeError for external use
export { MediumOfExchangeError };
import type {
  MediumOfExchangeInDHT,
  UIMediumOfExchange,
  MediumsOfExchangeCollection
} from '$lib/schemas/mediums-of-exchange.schemas';
import {
  MediumOfExchangeRecordSchema,
  MediumOfExchangeRecordOrNullSchema,
  MediumOfExchangeRecordsArraySchema,
  VoidResponseSchema
} from '$lib/schemas/mediums-of-exchange.schemas';

// Re-export types for external use
export type {
  MediumOfExchangeInDHT,
  UIMediumOfExchange,
  MediumsOfExchangeCollection,
  MediumOfExchangeRecordSchema,
  MediumOfExchangeRecordOrNullSchema,
  MediumOfExchangeRecordsArraySchema,
  VoidResponseSchema
};

// --- Service Interface ---

export interface MediumsOfExchangeService {
  readonly suggestMediumOfExchange: (
    mediumOfExchange: MediumOfExchangeInDHT
  ) => E.Effect<Record, MediumOfExchangeError>;

  readonly createMediumOfExchange: (
    mediumOfExchange: MediumOfExchangeInDHT
  ) => E.Effect<Record, MediumOfExchangeError>;

  readonly getMediumOfExchange: (
    mediumOfExchangeHash: ActionHash
  ) => E.Effect<Record | null, MediumOfExchangeError>;

  readonly getLatestMediumOfExchangeRecord: (
    originalActionHash: ActionHash
  ) => E.Effect<Record | null, MediumOfExchangeError>;

  readonly getAllMediumsOfExchange: () => E.Effect<Record[], MediumOfExchangeError>;

  readonly getPendingMediumsOfExchange: () => E.Effect<Record[], MediumOfExchangeError>;

  readonly getApprovedMediumsOfExchange: () => E.Effect<Record[], MediumOfExchangeError>;

  readonly getRejectedMediumsOfExchange: () => E.Effect<Record[], MediumOfExchangeError>;

  readonly approveMediumOfExchange: (
    mediumOfExchangeHash: ActionHash
  ) => E.Effect<void, MediumOfExchangeError>;

  readonly rejectMediumOfExchange: (
    mediumOfExchangeHash: ActionHash
  ) => E.Effect<void, MediumOfExchangeError>;

  readonly getMediumsOfExchangeForEntity: (
    entityHash: ActionHash,
    entity: 'request' | 'offer'
  ) => E.Effect<ActionHash[], MediumOfExchangeError>;

  readonly updateMediumOfExchange: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedMediumOfExchange: MediumOfExchangeInDHT
  ) => E.Effect<Record, MediumOfExchangeError>;

  readonly deleteMediumOfExchange: (
    mediumOfExchangeHash: ActionHash
  ) => E.Effect<void, MediumOfExchangeError>;
}

export class MediumsOfExchangeServiceTag extends Context.Tag('MediumsOfExchangeService')<
  MediumsOfExchangeServiceTag,
  MediumsOfExchangeService
>() {}

export const MediumsOfExchangeServiceLive: Layer.Layer<
  MediumsOfExchangeServiceTag,
  never,
  HolochainClientServiceTag
> = Layer.effect(
  MediumsOfExchangeServiceTag,
  E.gen(function* () {
    const holochainClient = yield* HolochainClientServiceTag;

    // Helper to wrap Promise-based methods in Effect
    const wrapZomeCall = <T>(
      zomeName: string,
      fnName: string,
      payload: unknown,
      context: string = MEDIUM_OF_EXCHANGE_CONTEXTS.GET_MEDIUM
    ): E.Effect<T, MediumOfExchangeError> =>
      wrapZomeCallWithErrorFactory(
        holochainClient,
        zomeName,
        fnName,
        payload,
        context,
        MediumOfExchangeError.fromError
      );

    const suggestMediumOfExchange = (
      mediumOfExchange: MediumOfExchangeInDHT
    ): E.Effect<Record, MediumOfExchangeError> =>
      wrapZomeCall('mediums_of_exchange', 'suggest_medium_of_exchange', {
        medium_of_exchange: mediumOfExchange
      });

    const createMediumOfExchange = (
      mediumOfExchange: MediumOfExchangeInDHT
    ): E.Effect<Record, MediumOfExchangeError> =>
      wrapZomeCall('mediums_of_exchange', 'create_medium_of_exchange', {
        medium_of_exchange: mediumOfExchange
      });

    const getMediumOfExchange = (
      mediumOfExchangeHash: ActionHash
    ): E.Effect<Record | null, MediumOfExchangeError> =>
      wrapZomeCall('mediums_of_exchange', 'get_medium_of_exchange', mediumOfExchangeHash);

    const getLatestMediumOfExchangeRecord = (
      originalActionHash: ActionHash
    ): E.Effect<Record | null, MediumOfExchangeError> =>
      wrapZomeCall(
        'mediums_of_exchange',
        'get_latest_medium_of_exchange_record',
        originalActionHash
      );

    const getAllMediumsOfExchange = (): E.Effect<Record[], MediumOfExchangeError> =>
      wrapZomeCall('mediums_of_exchange', 'get_all_mediums_of_exchange', null);

    const getPendingMediumsOfExchange = (): E.Effect<Record[], MediumOfExchangeError> =>
      wrapZomeCall('mediums_of_exchange', 'get_pending_mediums_of_exchange', null);

    const getApprovedMediumsOfExchange = (): E.Effect<Record[], MediumOfExchangeError> =>
      wrapZomeCall('mediums_of_exchange', 'get_approved_mediums_of_exchange', null);

    const getRejectedMediumsOfExchange = (): E.Effect<Record[], MediumOfExchangeError> =>
      wrapZomeCall('mediums_of_exchange', 'get_rejected_mediums_of_exchange', null);

    const approveMediumOfExchange = (
      mediumOfExchangeHash: ActionHash
    ): E.Effect<void, MediumOfExchangeError> =>
      wrapZomeCall('mediums_of_exchange', 'approve_medium_of_exchange', mediumOfExchangeHash);

    const rejectMediumOfExchange = (
      mediumOfExchangeHash: ActionHash
    ): E.Effect<void, MediumOfExchangeError> =>
      wrapZomeCall('mediums_of_exchange', 'reject_medium_of_exchange', mediumOfExchangeHash);

    const getMediumsOfExchangeForEntity = (
      entityHash: ActionHash,
      entity: 'request' | 'offer'
    ): E.Effect<ActionHash[], MediumOfExchangeError> =>
      wrapZomeCall('mediums_of_exchange', 'get_mediums_of_exchange_for_entity', {
        original_action_hash: entityHash,
        entity: entity
      });

    const updateMediumOfExchange = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedMediumOfExchange: MediumOfExchangeInDHT
    ): E.Effect<Record, MediumOfExchangeError> =>
      wrapZomeCall('mediums_of_exchange', 'update_medium_of_exchange', {
        original_action_hash: originalActionHash,
        previous_action_hash: previousActionHash,
        updated_medium_of_exchange: updatedMediumOfExchange
      });

    const deleteMediumOfExchange = (
      mediumOfExchangeHash: ActionHash
    ): E.Effect<void, MediumOfExchangeError> =>
      wrapZomeCall('mediums_of_exchange', 'delete_medium_of_exchange', mediumOfExchangeHash);

    return {
      suggestMediumOfExchange,
      createMediumOfExchange,
      getMediumOfExchange,
      getLatestMediumOfExchangeRecord,
      getAllMediumsOfExchange,
      getPendingMediumsOfExchange,
      getApprovedMediumsOfExchange,
      getRejectedMediumsOfExchange,
      approveMediumOfExchange,
      rejectMediumOfExchange,
      getMediumsOfExchangeForEntity,
      updateMediumOfExchange,
      deleteMediumOfExchange
    } satisfies MediumsOfExchangeService;
  })
);
