import type { ActionHash, Record } from '@holochain/client';
import { type RequestInDHT, type RequestInput } from '$lib/types/holochain';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { Effect as E, Layer, Context, Data, pipe } from 'effect';

// --- Error Types ---

export class RequestError extends Data.TaggedError('RequestError')<{
  message: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): RequestError {
    if (error instanceof Error) {
      return new RequestError({
        message: `${context}: ${error.message}`,
        cause: error
      });
    }
    return new RequestError({
      message: `${context}: ${String(error)}`,
      cause: error
    });
  }
}

// --- Service Interface ---

export interface RequestsService {
  readonly createRequest: (
    request: RequestInput,
    organizationHash?: ActionHash
  ) => E.Effect<Record, RequestError>;
  readonly getLatestRequestRecord: (
    originalActionHash: ActionHash
  ) => E.Effect<Record | null, RequestError>;
  readonly getLatestRequest: (
    originalActionHash: ActionHash
  ) => E.Effect<RequestInDHT | null, RequestError>;
  readonly updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInput
  ) => E.Effect<Record, RequestError>;
  readonly getAllRequestsRecords: () => E.Effect<Record[], RequestError>;
  readonly getUserRequestsRecords: (userHash: ActionHash) => E.Effect<Record[], RequestError>;
  readonly getOrganizationRequestsRecords: (
    organizationHash: ActionHash
  ) => E.Effect<Record[], RequestError>;
  readonly deleteRequest: (requestHash: ActionHash) => E.Effect<boolean, RequestError>;
}

export class RequestsServiceTag extends Context.Tag('RequestsService')<
  RequestsServiceTag,
  RequestsService
>() {}

export const RequestsServiceLive: Layer.Layer<
  RequestsServiceTag,
  never,
  HolochainClientServiceTag
> = Layer.effect(
  RequestsServiceTag,
  E.gen(function* ($) {
    const holochainClient = yield* $(HolochainClientServiceTag);

    const createRequest = (
      request: RequestInput,
      organizationHash?: ActionHash
    ): E.Effect<Record, RequestError> =>
      pipe(
        E.tryPromise({
          try: () => {
            // Extract service_type_hashes from the request
            const { service_type_hashes, ...requestData } = request;

            return holochainClient.callZome('requests', 'create_request', {
              request: requestData,
              organization: organizationHash,
              service_type_hashes: service_type_hashes || []
            });
          },
          catch: (error: unknown) => RequestError.fromError(error, 'Failed to create request')
        }),
        E.map((record: unknown) => record as Record)
      );

    const getLatestRequestRecord = (
      originalActionHash: ActionHash
    ): E.Effect<Record | null, RequestError> =>
      pipe(
        E.tryPromise({
          try: () =>
            holochainClient.callZome('requests', 'get_latest_request_record', originalActionHash),
          catch: (error: unknown) =>
            RequestError.fromError(error, 'Failed to get latest request record')
        }),
        E.map((record: unknown) => record as Record | null)
      );

    const getLatestRequest = (
      originalActionHash: ActionHash
    ): E.Effect<RequestInDHT | null, RequestError> =>
      pipe(
        E.tryPromise({
          try: () => holochainClient.callZome('requests', 'get_latest_request', originalActionHash),
          catch: (error: unknown) => RequestError.fromError(error, 'Failed to get latest request')
        }),
        E.map((request: unknown) => request as RequestInDHT | null)
      );

    const updateRequest = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updated_request: RequestInput
    ): E.Effect<Record, RequestError> =>
      pipe(
        E.tryPromise({
          try: () => {
            // Extract service_type_hashes from the request
            const { service_type_hashes, ...requestData } = updated_request;

            return holochainClient.callZome('requests', 'update_request', {
              original_action_hash: originalActionHash,
              previous_action_hash: previousActionHash,
              updated_request: requestData,
              service_type_hashes: service_type_hashes || []
            });
          },
          catch: (error: unknown) => RequestError.fromError(error, 'Failed to update request')
        }),
        E.map((record: unknown) => record as Record)
      );

    const getAllRequestsRecords = (): E.Effect<Record[], RequestError> =>
      pipe(
        E.tryPromise({
          try: () => holochainClient.callZome('requests', 'get_all_requests', null),
          catch: (error: unknown) => RequestError.fromError(error, 'Failed to get all requests')
        }),
        E.map((records: unknown) => records as Record[])
      );

    const getUserRequestsRecords = (userHash: ActionHash): E.Effect<Record[], RequestError> =>
      pipe(
        E.tryPromise({
          try: () => holochainClient.callZome('requests', 'get_user_requests', userHash),
          catch: (error: unknown) => RequestError.fromError(error, 'Failed to get user requests')
        }),
        E.map((records: unknown) => records as Record[])
      );

    const getOrganizationRequestsRecords = (
      organizationHash: ActionHash
    ): E.Effect<Record[], RequestError> =>
      pipe(
        E.tryPromise({
          try: () =>
            holochainClient.callZome('requests', 'get_organization_requests', organizationHash),
          catch: (error: unknown) =>
            RequestError.fromError(error, 'Failed to get organization requests')
        }),
        E.map((records: unknown) => records as Record[])
      );

    const deleteRequest = (requestHash: ActionHash): E.Effect<boolean, RequestError> =>
      pipe(
        E.tryPromise({
          try: () => holochainClient.callZome('requests', 'delete_request', requestHash),
          catch: (error: unknown) => RequestError.fromError(error, 'Failed to delete request')
        }),
        E.map((result: unknown) => result as boolean)
      );

    return RequestsServiceTag.of({
      createRequest,
      getLatestRequestRecord,
      getLatestRequest,
      updateRequest,
      getAllRequestsRecords,
      getUserRequestsRecords,
      getOrganizationRequestsRecords,
      deleteRequest
    });
  })
);
