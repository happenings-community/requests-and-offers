import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { Effect as E, Layer, Context, pipe } from 'effect';
import { MediumOfExchangeError } from '$lib/errors/mediums-of-exchange.errors';
import { MEDIUM_OF_EXCHANGE_CONTEXTS } from '$lib/errors/error-contexts';

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
  E.gen(function* ($) {
    const holochainClient = yield* $(HolochainClientServiceTag);

    const suggestMediumOfExchange = (
      mediumOfExchange: MediumOfExchangeInDHT
    ): E.Effect<Record, MediumOfExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('mediums_of_exchange', 'suggest_medium_of_exchange', {
          medium_of_exchange: mediumOfExchange
        }),
        E.map((result) => result as Record),
        E.mapError((error) =>
          MediumOfExchangeError.fromError(error, MEDIUM_OF_EXCHANGE_CONTEXTS.SUGGEST_MEDIUM)
        )
      );

    const getMediumOfExchange = (
      mediumOfExchangeHash: ActionHash
    ): E.Effect<Record | null, MediumOfExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'mediums_of_exchange',
          'get_medium_of_exchange',
          mediumOfExchangeHash
        ),
        E.map((result) => result as Record | null),
        E.mapError((error) =>
          MediumOfExchangeError.fromError(error, MEDIUM_OF_EXCHANGE_CONTEXTS.GET_MEDIUM)
        )
      );

    const getLatestMediumOfExchangeRecord = (
      originalActionHash: ActionHash
    ): E.Effect<Record | null, MediumOfExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'mediums_of_exchange',
          'get_latest_medium_of_exchange_record',
          originalActionHash
        ),
        E.map((result) => result as Record | null),
        E.mapError((error) =>
          MediumOfExchangeError.fromError(
            error,
            MEDIUM_OF_EXCHANGE_CONTEXTS.GET_LATEST_MEDIUM_RECORD
          )
        )
      );

    const getAllMediumsOfExchange = (): E.Effect<Record[], MediumOfExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'mediums_of_exchange',
          'get_all_mediums_of_exchange',
          null
        ),
        E.map((result) => result as Record[]),
        E.mapError((error) =>
          MediumOfExchangeError.fromError(error, MEDIUM_OF_EXCHANGE_CONTEXTS.GET_ALL_MEDIUMS)
        )
      );

    const getPendingMediumsOfExchange = (): E.Effect<Record[], MediumOfExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'mediums_of_exchange',
          'get_pending_mediums_of_exchange',
          null
        ),
        E.map((result) => result as Record[]),
        E.mapError((error) =>
          MediumOfExchangeError.fromError(error, MEDIUM_OF_EXCHANGE_CONTEXTS.GET_PENDING_MEDIUMS)
        )
      );

    const getApprovedMediumsOfExchange = (): E.Effect<Record[], MediumOfExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'mediums_of_exchange',
          'get_approved_mediums_of_exchange',
          null
        ),
        E.map((result) => result as Record[]),
        E.mapError((error) =>
          MediumOfExchangeError.fromError(error, MEDIUM_OF_EXCHANGE_CONTEXTS.GET_APPROVED_MEDIUMS)
        )
      );

    const getRejectedMediumsOfExchange = (): E.Effect<Record[], MediumOfExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'mediums_of_exchange',
          'get_rejected_mediums_of_exchange',
          null
        ),
        E.map((result) => result as Record[]),
        E.mapError((error) =>
          MediumOfExchangeError.fromError(error, MEDIUM_OF_EXCHANGE_CONTEXTS.GET_REJECTED_MEDIUMS)
        )
      );

    const approveMediumOfExchange = (
      mediumOfExchangeHash: ActionHash
    ): E.Effect<void, MediumOfExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'mediums_of_exchange',
          'approve_medium_of_exchange',
          mediumOfExchangeHash
        ),
        E.map(() => void 0),
        E.mapError((error) =>
          MediumOfExchangeError.fromError(error, MEDIUM_OF_EXCHANGE_CONTEXTS.APPROVE_MEDIUM)
        )
      );

    const rejectMediumOfExchange = (
      mediumOfExchangeHash: ActionHash
    ): E.Effect<void, MediumOfExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'mediums_of_exchange',
          'reject_medium_of_exchange',
          mediumOfExchangeHash
        ),
        E.map(() => void 0),
        E.mapError((error) =>
          MediumOfExchangeError.fromError(error, MEDIUM_OF_EXCHANGE_CONTEXTS.REJECT_MEDIUM)
        )
      );

    const getMediumsOfExchangeForEntity = (
      entityHash: ActionHash,
      entity: 'request' | 'offer'
    ): E.Effect<ActionHash[], MediumOfExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'mediums_of_exchange',
          'get_mediums_of_exchange_for_entity',
          {
            original_action_hash: entityHash,
            entity: entity
          }
        ),
        E.map((result) => result as ActionHash[]),
        E.mapError((error) =>
          MediumOfExchangeError.fromError(error, MEDIUM_OF_EXCHANGE_CONTEXTS.GET_MEDIUMS_FOR_ENTITY)
        )
      );

    const updateMediumOfExchange = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedMediumOfExchange: MediumOfExchangeInDHT
    ): E.Effect<Record, MediumOfExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('mediums_of_exchange', 'update_medium_of_exchange', {
          original_action_hash: originalActionHash,
          previous_action_hash: previousActionHash,
          updated_medium_of_exchange: updatedMediumOfExchange
        }),
        E.map((result) => result as Record),
        E.mapError((error) =>
          MediumOfExchangeError.fromError(error, MEDIUM_OF_EXCHANGE_CONTEXTS.UPDATE_MEDIUM)
        )
      );

    const deleteMediumOfExchange = (
      mediumOfExchangeHash: ActionHash
    ): E.Effect<void, MediumOfExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'mediums_of_exchange',
          'delete_medium_of_exchange',
          mediumOfExchangeHash
        ),
        E.map(() => void 0),
        E.mapError((error) =>
          MediumOfExchangeError.fromError(error, MEDIUM_OF_EXCHANGE_CONTEXTS.DELETE_MEDIUM)
        )
      );

    return {
      suggestMediumOfExchange,
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
