import type { ActionHash, Record } from '@holochain/client';
import { type RequestInDHT, type RequestInput } from '$lib/types/holochain';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { Effect as E, Layer, Context, pipe } from 'effect';
import { RequestError } from '$lib/errors';
import { wrapPromise } from '$lib/utils';

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
        wrapPromise(
          () => {
            // Extract service_type_hashes from the request
            const { service_type_hashes, ...requestData } = request;

            return holochainClient.callZome('requests', 'create_request', {
              request: requestData,
              organization: organizationHash,
              service_type_hashes: service_type_hashes || []
            });
          },
          RequestError,
          'Failed to create request'
        ),
        E.map((record: unknown) => record as Record)
      );

    const getLatestRequestRecord = (
      originalActionHash: ActionHash
    ): E.Effect<Record | null, RequestError> =>
      pipe(
        wrapPromise(
          () =>
            holochainClient.callZome('requests', 'get_latest_request_record', originalActionHash),
          RequestError,
          'Failed to get latest request record'
        ),
        E.map((record: unknown) => record as Record | null)
      );

    const getLatestRequest = (
      originalActionHash: ActionHash
    ): E.Effect<RequestInDHT | null, RequestError> =>
      pipe(
        wrapPromise(
          () => holochainClient.callZome('requests', 'get_latest_request', originalActionHash),
          RequestError,
          'Failed to get latest request'
        ),
        E.map((request: unknown) => request as RequestInDHT | null)
      );

    const updateRequest = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updated_request: RequestInput
    ): E.Effect<Record, RequestError> =>
      pipe(
        wrapPromise(
          () => {
            // Extract service_type_hashes from the request
            const { service_type_hashes, ...requestData } = updated_request;

            return holochainClient.callZome('requests', 'update_request', {
              original_action_hash: originalActionHash,
              previous_action_hash: previousActionHash,
              updated_request: requestData,
              service_type_hashes: service_type_hashes || []
            });
          },
          RequestError,
          'Failed to update request'
        ),
        E.map((record: unknown) => record as Record)
      );

    const getAllRequestsRecords = (): E.Effect<Record[], RequestError> =>
      pipe(
        wrapPromise(
          () => holochainClient.callZome('requests', 'get_all_requests', null),
          RequestError,
          'Failed to get all requests'
        ),
        E.map((records: unknown) => records as Record[])
      );

    const getUserRequestsRecords = (userHash: ActionHash): E.Effect<Record[], RequestError> =>
      pipe(
        wrapPromise(
          () => holochainClient.callZome('requests', 'get_user_requests', userHash),
          RequestError,
          'Failed to get user requests'
        ),
        E.map((records: unknown) => records as Record[])
      );

    const getOrganizationRequestsRecords = (
      organizationHash: ActionHash
    ): E.Effect<Record[], RequestError> =>
      pipe(
        wrapPromise(
          () => holochainClient.callZome('requests', 'get_organization_requests', organizationHash),
          RequestError,
          'Failed to get organization requests'
        ),
        E.map((records: unknown) => records as Record[])
      );

    const deleteRequest = (requestHash: ActionHash): E.Effect<boolean, RequestError> =>
      pipe(
        wrapPromise(
          () => holochainClient.callZome('requests', 'delete_request', requestHash),
          RequestError,
          'Failed to delete request'
        ),
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
