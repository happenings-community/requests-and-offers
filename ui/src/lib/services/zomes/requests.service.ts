import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { Effect as E, Layer, Context, pipe } from 'effect';
import { RequestError } from '$lib/errors/requests.errors';
import { REQUEST_CONTEXTS } from '$lib/errors/error-contexts';
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
  readonly archiveRequest: (requestHash: ActionHash) => E.Effect<boolean, RequestError>;
  readonly getMyListings: (userHash: ActionHash) => E.Effect<Record[], RequestError>;
  readonly getRequestsByTag: (tag: string) => E.Effect<Record[], RequestError>;
  readonly getServiceTypesForRequest: (
    requestHash: ActionHash
  ) => E.Effect<ActionHash[], RequestError>;
  readonly getMediumsOfExchangeForRequest: (
    requestHash: ActionHash
  ) => E.Effect<ActionHash[], RequestError>;
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
  E.gen(function* () {
    const holochainClient = yield* HolochainClientServiceTag;

    const createRequest = (
      request: RequestInput,
      organizationHash?: ActionHash
    ): E.Effect<Record, RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect('requests', 'create_request', {
          request: {
            title: request.title,
            description: request.description,
            contact_preference: request.contact_preference,
            date_range: request.date_range,
            time_estimate_hours: request.time_estimate_hours,
            time_preference: request.time_preference,
            time_zone: request.time_zone,
            interaction_type: request.interaction_type,
            links: request.links,
            status: 'Active' // Default status for new requests
          },
          organization: organizationHash,
          service_type_hashes: request.service_type_hashes || [],
          medium_of_exchange_hashes: request.medium_of_exchange_hashes || []
        }),
        E.map((record) => record as Record),
        E.catchAll((error) => {
          if (error instanceof RequestError) {
            return E.fail(error);
          }
          return E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.CREATE_REQUEST));
        })
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
        E.mapError((error) =>
          RequestError.fromError(error, REQUEST_CONTEXTS.GET_LATEST_REQUEST_RECORD)
        )
      );

    const getLatestRequest = (
      originalActionHash: ActionHash
    ): E.Effect<RequestInDHT | null, RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect('requests', 'get_latest_request', originalActionHash),
        E.map((request) => request as RequestInDHT | null),
        E.catchAll((error) => {
          if (error instanceof RequestError) {
            return E.fail(error);
          }
          return E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.GET_LATEST_REQUEST));
        })
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
          updated_request: {
            title: updated_request.title,
            description: updated_request.description,
            contact_preference: updated_request.contact_preference,
            date_range: updated_request.date_range,
            time_estimate_hours: updated_request.time_estimate_hours,
            time_preference: updated_request.time_preference,
            time_zone: updated_request.time_zone,
            interaction_type: updated_request.interaction_type,
            links: updated_request.links,
            status: 'Active' // Default status for updated requests
          },
          service_type_hashes: updated_request.service_type_hashes || [],
          medium_of_exchange_hashes: updated_request.medium_of_exchange_hashes || []
        }),
        E.map((record) => record as Record),
        E.catchAll((error) => {
          if (error instanceof RequestError) {
            return E.fail(error);
          }
          return E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.UPDATE_REQUEST));
        })
      );

    const getAllRequestsRecords = (): E.Effect<Record[], RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect('requests', 'get_all_requests', null),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof RequestError) {
            return E.fail(error);
          }
          return E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.GET_ALL_REQUESTS));
        })
      );

    const getUserRequestsRecords = (userHash: ActionHash): E.Effect<Record[], RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect('requests', 'get_user_requests', userHash),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof RequestError) {
            return E.fail(error);
          }
          return E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.GET_USER_REQUESTS));
        })
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
        E.mapError((error) =>
          RequestError.fromError(error, REQUEST_CONTEXTS.GET_ORGANIZATION_REQUESTS)
        )
      );

    const deleteRequest = (requestHash: ActionHash): E.Effect<boolean, RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect('requests', 'delete_request', requestHash),
        E.map((result) => result as boolean),
        E.catchAll((error) => {
          if (error instanceof RequestError) {
            return E.fail(error);
          }
          return E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.DELETE_REQUEST));
        })
      );

    const archiveRequest = (requestHash: ActionHash): E.Effect<boolean, RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect('requests', 'archive_request', requestHash),
        E.map((result) => result as boolean),
        E.catchAll((error) => {
          if (error instanceof RequestError) {
            return E.fail(error);
          }
          return E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.ARCHIVE_REQUEST));
        })
      );

    const getMyListings = (userHash: ActionHash): E.Effect<Record[], RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect('requests', 'get_my_listings', userHash),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof RequestError) {
            return E.fail(error);
          }
          return E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.GET_MY_LISTINGS));
        })
      );

    const getRequestsByTag = (tag: string): E.Effect<Record[], RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect('requests', 'get_requests_by_tag', tag),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof RequestError) {
            return E.fail(error);
          }
          return E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.GET_REQUESTS_BY_TAG));
        })
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
          RequestError.fromError(error, REQUEST_CONTEXTS.GET_SERVICE_TYPES_FOR_REQUEST)
        )
      );

    const getMediumsOfExchangeForRequest = (
      requestHash: ActionHash
    ): E.Effect<ActionHash[], RequestError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'mediums_of_exchange',
          'get_mediums_of_exchange_for_entity',
          {
            original_action_hash: requestHash,
            entity: 'request'
          }
        ),
        E.map((hashes) => hashes as ActionHash[]),
        E.mapError((error) =>
          RequestError.fromError(error, REQUEST_CONTEXTS.GET_MEDIUMS_OF_EXCHANGE_FOR_REQUEST)
        )
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
      archiveRequest,
      getMyListings,
      getRequestsByTag,
      getServiceTypesForRequest,
      getMediumsOfExchangeForRequest
    });
  })
);
