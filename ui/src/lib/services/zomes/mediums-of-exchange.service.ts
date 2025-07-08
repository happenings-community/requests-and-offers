import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { Effect as E, Layer, Context, pipe } from 'effect';
import { MediumOfExchangeError } from '$lib/errors/mediums-of-exchange.errors';

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
          MediumOfExchangeError.fromError(error, 'Failed to suggest medium of exchange')
        )
      );

    const getMediumOfExchange = (
      mediumOfExchangeHash: ActionHash
    ): E.Effect<Record | null, MediumOfExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'mediums_of_exchange',
          'get_medium_of_exchange',
          // Ensure ActionHash is properly serialized by creating a clean Uint8Array
          new Uint8Array(mediumOfExchangeHash)
        ),
        E.map((result) => result as Record | null),
        E.mapError((error) =>
          MediumOfExchangeError.fromError(error, 'Failed to get medium of exchange')
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
          MediumOfExchangeError.fromError(error, 'Failed to get all mediums of exchange')
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
          MediumOfExchangeError.fromError(error, 'Failed to get pending mediums of exchange')
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
          MediumOfExchangeError.fromError(error, 'Failed to get approved mediums of exchange')
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
          MediumOfExchangeError.fromError(error, 'Failed to get rejected mediums of exchange')
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
          MediumOfExchangeError.fromError(error, 'Failed to approve medium of exchange')
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
          MediumOfExchangeError.fromError(error, 'Failed to reject medium of exchange')
        )
      );

    return {
      suggestMediumOfExchange,
      getMediumOfExchange,
      getAllMediumsOfExchange,
      getPendingMediumsOfExchange,
      getApprovedMediumsOfExchange,
      getRejectedMediumsOfExchange,
      approveMediumOfExchange,
      rejectMediumOfExchange
    } satisfies MediumsOfExchangeService;
  })
);
