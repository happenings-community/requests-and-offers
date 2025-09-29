import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { Effect as E, Layer, Context } from 'effect';
import { RequestError } from '$lib/errors/requests.errors';
import { REQUEST_CONTEXTS } from '$lib/errors/error-contexts';
import { RequestInDHT, RequestInput } from '$lib/schemas/requests.schemas';
import { wrapZomeCallWithErrorFactory } from '$lib/utils/zome-helpers';

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

    // Simple wrapper for Promise-based zome calls
    const wrapZomeCall = <T>(
      zomeName: string,
      fnName: string,
      payload: unknown,
      context: string = REQUEST_CONTEXTS.CREATE_REQUEST
    ): E.Effect<T, RequestError> =>
      wrapZomeCallWithErrorFactory(
        holochainClient,
        zomeName,
        fnName,
        payload,
        context,
        RequestError.fromError
      );

    const createRequest = (
      request: RequestInput,
      organizationHash?: ActionHash
    ): E.Effect<Record, RequestError> =>
      wrapZomeCall('requests', 'create_request', {
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
      });

    const getLatestRequestRecord = (
      originalActionHash: ActionHash
    ): E.Effect<Record | null, RequestError> =>
      wrapZomeCall('requests', 'get_latest_request_record', originalActionHash);

    const getLatestRequest = (
      originalActionHash: ActionHash
    ): E.Effect<RequestInDHT | null, RequestError> =>
      wrapZomeCall('requests', 'get_latest_request', originalActionHash);

    const updateRequest = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updated_request: RequestInput
    ): E.Effect<Record, RequestError> =>
      wrapZomeCall('requests', 'update_request', {
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
      });

    const getAllRequestsRecords = (): E.Effect<Record[], RequestError> =>
      wrapZomeCall('requests', 'get_all_requests', null);

    const getUserRequestsRecords = (userHash: ActionHash): E.Effect<Record[], RequestError> =>
      wrapZomeCall('requests', 'get_user_requests', userHash);

    const getOrganizationRequestsRecords = (
      organizationHash: ActionHash
    ): E.Effect<Record[], RequestError> =>
      wrapZomeCall('requests', 'get_organization_requests', organizationHash);

    const deleteRequest = (requestHash: ActionHash): E.Effect<boolean, RequestError> =>
      wrapZomeCall('requests', 'delete_request', requestHash);

    const archiveRequest = (requestHash: ActionHash): E.Effect<boolean, RequestError> =>
      wrapZomeCall('requests', 'archive_request', requestHash);

    const getMyListings = (userHash: ActionHash): E.Effect<Record[], RequestError> =>
      wrapZomeCall('requests', 'get_my_listings', userHash);

    const getRequestsByTag = (tag: string): E.Effect<Record[], RequestError> =>
      wrapZomeCall('requests', 'get_requests_by_tag', tag);

    const getServiceTypesForRequest = (
      requestHash: ActionHash
    ): E.Effect<ActionHash[], RequestError> =>
      wrapZomeCall('service_types', 'get_service_types_for_entity', {
        original_action_hash: requestHash,
        entity: 'request'
      });

    const getMediumsOfExchangeForRequest = (
      requestHash: ActionHash
    ): E.Effect<ActionHash[], RequestError> =>
      wrapZomeCall('mediums_of_exchange', 'get_mediums_of_exchange_for_entity', {
        original_action_hash: requestHash,
        entity: 'request'
      });

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
