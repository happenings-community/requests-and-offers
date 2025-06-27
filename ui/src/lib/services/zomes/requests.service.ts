import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { Effect as E, Layer, Context, pipe } from 'effect';
import { RequestError } from '$lib/errors/requests.errors';
import { RequestInDHT, RequestInput } from '$lib/schemas/requests.schemas';

// Re-export RequestError for external use
export { RequestError };

// Re-export types for external use
export type { RequestInDHT, RequestInput };

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
  readonly getRequestsByTag: (tag: string) => E.Effect<Record[], RequestError>;
  readonly getServiceTypesForRequest: (
    requestHash: ActionHash
  ) => E.Effect<ActionHash[], RequestError>;
  readonly getRequestCreator: (
    requestHash: ActionHash
  ) => E.Effect<ActionHash | null, RequestError>;
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
        holochainClient.callZomeRawEffect('requests', 'create_request', {
          request,
          organization: organizationHash,
          service_type_hashes: request.service_type_hashes || []
        }),
        E.map((record) => record as Record),
        E.mapError((error) => RequestError.fromError(error, 'Failed to create request'))
      );

    const getLatestRequestRecord = (
      originalActionHash: ActionHash
    ): E.Effect<Record | null, RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'requests',
          'get_latest_request_record',
          originalActionHash
        ),
        E.map((record) => record as Record | null),
        E.mapError((error) => RequestError.fromError(error, 'Failed to get latest request record'))
      );

    const getLatestRequest = (
      originalActionHash: ActionHash
    ): E.Effect<RequestInDHT | null, RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect('requests', 'get_latest_request', originalActionHash),
        E.map((request) => request as RequestInDHT | null),
        E.mapError((error) => RequestError.fromError(error, 'Failed to get latest request'))
      );

    const updateRequest = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updated_request: RequestInput
    ): E.Effect<Record, RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect('requests', 'update_request', {
          original_action_hash: originalActionHash,
          previous_action_hash: previousActionHash,
          updated_request,
          service_type_hashes: updated_request.service_type_hashes || []
        }),
        E.map((record) => record as Record),
        E.mapError((error) => RequestError.fromError(error, 'Failed to update request'))
      );

    const getAllRequestsRecords = (): E.Effect<Record[], RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect('requests', 'get_all_requests', null),
        E.map((records) => records as Record[]),
        E.mapError((error) => RequestError.fromError(error, 'Failed to get all requests'))
      );

    const getUserRequestsRecords = (userHash: ActionHash): E.Effect<Record[], RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect('requests', 'get_user_requests', userHash),
        E.map((records) => records as Record[]),
        E.mapError((error) => RequestError.fromError(error, 'Failed to get user requests'))
      );

    const getOrganizationRequestsRecords = (
      organizationHash: ActionHash
    ): E.Effect<Record[], RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'requests',
          'get_organization_requests',
          organizationHash
        ),
        E.map((records) => records as Record[]),
        E.mapError((error) => RequestError.fromError(error, 'Failed to get organization requests'))
      );

    const deleteRequest = (requestHash: ActionHash): E.Effect<boolean, RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect('requests', 'delete_request', requestHash),
        E.map((result) => result as boolean),
        E.mapError((error) => RequestError.fromError(error, 'Failed to delete request'))
      );

    const getRequestsByTag = (tag: string): E.Effect<Record[], RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect('requests', 'get_requests_by_tag', tag),
        E.map((records) => records as Record[]),
        E.mapError((error) => RequestError.fromError(error, 'Failed to get requests by tag'))
      );

    const getServiceTypesForRequest = (
      requestHash: ActionHash
    ): E.Effect<ActionHash[], RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'get_service_types_for_entity', {
          original_action_hash: requestHash,
          entity: 'request'
        }),
        E.map((hashes) => hashes as ActionHash[]),
        E.mapError((error) =>
          RequestError.fromError(error, 'Failed to get service types for request')
        )
      );

    const getRequestCreator = (
      requestHash: ActionHash
    ): E.Effect<ActionHash | null, RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect('requests', 'get_request_creator', requestHash),
        E.map((hash) => hash as ActionHash | null),
        E.mapError((error) => RequestError.fromError(error, 'Failed to get request creator'))
      );

    return RequestsServiceTag.of({
      createRequest,
      getLatestRequestRecord,
      getLatestRequest,
      updateRequest,
      getAllRequestsRecords,
      getUserRequestsRecords,
      getOrganizationRequestsRecords,
      deleteRequest,
      getRequestsByTag,
      getServiceTypesForRequest,
      getRequestCreator
    });
  })
);
