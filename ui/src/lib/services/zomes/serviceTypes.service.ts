import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { Effect as E, Layer, Context, pipe } from 'effect';
import { ServiceTypeError } from '$lib/errors/service-types.errors';
import { SERVICE_TYPE_CONTEXTS } from '$lib/errors/error-contexts';
import { wrapZomeCallWithErrorFactory } from '$lib/utils/zome-helpers';

// Re-export ServiceTypeError for external use
export { ServiceTypeError };
import {
  ServiceTypeInDHT,
  UIServiceType,
  ServiceTypeLinkInput,
  UpdateServiceTypeLinksInput,
  GetServiceTypeForEntityInput,
  ServiceTypesCollection,
  ServiceTypeRecordSchema,
  ServiceTypeRecordOrNullSchema,
  ServiceTypeRecordsArraySchema,
  ActionHashArraySchema,
  StringArraySchema,
  VoidResponseSchema
} from '$lib/schemas/service-types.schemas';

// Re-export types for external use
export type {
  ServiceTypeInDHT,
  UIServiceType,
  ServiceTypeLinkInput,
  UpdateServiceTypeLinksInput,
  GetServiceTypeForEntityInput,
  ServiceTypesCollection,
  ServiceTypeRecordSchema,
  ServiceTypeRecordOrNullSchema,
  ServiceTypeRecordsArraySchema,
  ActionHashArraySchema,
  StringArraySchema,
  VoidResponseSchema
};

// --- Type aliases for backward compatibility ---
// These will be removed after full refactoring is complete

// --- Service Interface ---

export interface ServiceTypesService {
  readonly createServiceType: (serviceType: ServiceTypeInDHT) => E.Effect<Record, ServiceTypeError>;

  readonly getServiceType: (
    serviceTypeHash: ActionHash
  ) => E.Effect<Record | null, ServiceTypeError>;

  readonly getLatestServiceTypeRecord: (
    originalActionHash: ActionHash
  ) => E.Effect<Record | null, ServiceTypeError>;

  readonly updateServiceType: (
    originalServiceTypeHash: ActionHash,
    previousServiceTypeHash: ActionHash,
    updatedServiceType: ServiceTypeInDHT
  ) => E.Effect<ActionHash, ServiceTypeError>;

  readonly deleteServiceType: (
    serviceTypeHash: ActionHash
  ) => E.Effect<ActionHash, ServiceTypeError>;

  readonly getAllServiceTypes: () => E.Effect<
    { pending: Record[]; approved: Record[]; rejected: Record[] },
    ServiceTypeError
  >;

  readonly getRequestsForServiceType: (
    serviceTypeHash: ActionHash
  ) => E.Effect<Record[], ServiceTypeError>;

  readonly getOffersForServiceType: (
    serviceTypeHash: ActionHash
  ) => E.Effect<Record[], ServiceTypeError>;

  readonly getUsersForServiceType: (
    serviceTypeHash: ActionHash
  ) => E.Effect<Record[], ServiceTypeError>;

  readonly getServiceTypesForEntity: (
    input: GetServiceTypeForEntityInput
  ) => E.Effect<ActionHash[], ServiceTypeError>;

  readonly linkToServiceType: (input: ServiceTypeLinkInput) => E.Effect<void, ServiceTypeError>;

  readonly unlinkFromServiceType: (input: ServiceTypeLinkInput) => E.Effect<void, ServiceTypeError>;

  readonly updateServiceTypeLinks: (
    input: UpdateServiceTypeLinksInput
  ) => E.Effect<void, ServiceTypeError>;

  readonly deleteAllServiceTypeLinksForEntity: (
    input: GetServiceTypeForEntityInput
  ) => E.Effect<void, ServiceTypeError>;

  // Status management methods
  readonly suggestServiceType: (
    serviceType: ServiceTypeInDHT
  ) => E.Effect<Record, ServiceTypeError>;

  readonly approveServiceType: (serviceTypeHash: ActionHash) => E.Effect<void, ServiceTypeError>;

  readonly rejectServiceType: (serviceTypeHash: ActionHash) => E.Effect<void, ServiceTypeError>;

  readonly getPendingServiceTypes: () => E.Effect<Record[], ServiceTypeError>;

  readonly getApprovedServiceTypes: () => E.Effect<Record[], ServiceTypeError>;

  readonly getRejectedServiceTypes: () => E.Effect<Record[], ServiceTypeError>;

  readonly getServiceTypeStatus: (
    serviceTypeHash: ActionHash
  ) => E.Effect<string, ServiceTypeError>;
}

export class ServiceTypesServiceTag extends Context.Tag('ServiceTypesService')<
  ServiceTypesServiceTag,
  ServiceTypesService
>() {}

export const ServiceTypesServiceLive: Layer.Layer<
  ServiceTypesServiceTag,
  never,
  HolochainClientServiceTag
> = Layer.effect(
  ServiceTypesServiceTag,
  E.gen(function* () {
    const holochainClient = yield* HolochainClientServiceTag;

    // Helper to wrap Promise-based methods in Effect
    const wrapZomeCall = <T>(
      zomeName: string,
      fnName: string,
      payload: unknown,
      context: string = SERVICE_TYPE_CONTEXTS.GET_SERVICE_TYPE
    ): E.Effect<T, ServiceTypeError> =>
      wrapZomeCallWithErrorFactory(
        holochainClient,
        zomeName,
        fnName,
        payload,
        context,
        ServiceTypeError.fromError
      );

    const createServiceType = (serviceType: ServiceTypeInDHT): E.Effect<Record, ServiceTypeError> =>
      wrapZomeCall('service_types', 'create_service_type', {
        service_type: serviceType
      });

    const getServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<Record | null, ServiceTypeError> =>
      wrapZomeCall('service_types', 'get_service_type', serviceTypeHash);

    const getLatestServiceTypeRecord = (
      originalActionHash: ActionHash
    ): E.Effect<Record | null, ServiceTypeError> =>
      wrapZomeCall('service_types', 'get_latest_service_type_record', originalActionHash);

    const updateServiceType = (
      originalServiceTypeHash: ActionHash,
      previousServiceTypeHash: ActionHash,
      updatedServiceType: ServiceTypeInDHT
    ): E.Effect<ActionHash, ServiceTypeError> =>
      wrapZomeCall('service_types', 'update_service_type', {
        original_service_type_hash: originalServiceTypeHash,
        previous_service_type_hash: previousServiceTypeHash,
        updated_service_type: updatedServiceType
      });

    const deleteServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<ActionHash, ServiceTypeError> =>
      wrapZomeCall('service_types', 'delete_service_type', serviceTypeHash);

    const getAllServiceTypes = (): E.Effect<
      { pending: Record[]; approved: Record[]; rejected: Record[] },
      ServiceTypeError
    > =>
      pipe(
        E.all(
          {
            pending: getPendingServiceTypes(),
            approved: getApprovedServiceTypes(),
            rejected: getRejectedServiceTypes()
          },
          { concurrency: 'inherit' } // Runs them concurrently
        ),
        E.map((result) => result),
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(
            new ServiceTypeError({
              message: `${SERVICE_TYPE_CONTEXTS.GET_ALL_SERVICE_TYPES}: ${String(error)}`,
              cause: error
            })
          );
        })
      );

    const getRequestsForServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<Record[], ServiceTypeError> =>
      wrapZomeCall('service_types', 'get_requests_for_service_type', serviceTypeHash);

    const getOffersForServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<Record[], ServiceTypeError> =>
      wrapZomeCall('service_types', 'get_offers_for_service_type', serviceTypeHash);

    const getUsersForServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<Record[], ServiceTypeError> =>
      wrapZomeCall('service_types', 'get_users_for_service_type', serviceTypeHash);

    const getServiceTypesForEntity = (
      input: GetServiceTypeForEntityInput
    ): E.Effect<ActionHash[], ServiceTypeError> =>
      wrapZomeCall('service_types', 'get_service_types_for_entity', input);

    const linkToServiceType = (input: ServiceTypeLinkInput): E.Effect<void, ServiceTypeError> =>
      wrapZomeCall('service_types', 'link_to_service_type', input);

    const unlinkFromServiceType = (input: ServiceTypeLinkInput): E.Effect<void, ServiceTypeError> =>
      wrapZomeCall('service_types', 'unlink_from_service_type', input);

    const updateServiceTypeLinks = (
      input: UpdateServiceTypeLinksInput
    ): E.Effect<void, ServiceTypeError> =>
      wrapZomeCall('service_types', 'update_service_type_links', input);

    const deleteAllServiceTypeLinksForEntity = (
      input: GetServiceTypeForEntityInput
    ): E.Effect<void, ServiceTypeError> =>
      wrapZomeCall('service_types', 'delete_all_service_type_links_for_entity', input);

    // Status management method implementations
    const suggestServiceType = (
      serviceType: ServiceTypeInDHT
    ): E.Effect<Record, ServiceTypeError> =>
      wrapZomeCall('service_types', 'suggest_service_type', {
        service_type: serviceType
      });

    const approveServiceType = (serviceTypeHash: ActionHash): E.Effect<void, ServiceTypeError> =>
      wrapZomeCall('service_types', 'approve_service_type', serviceTypeHash);

    const rejectServiceType = (serviceTypeHash: ActionHash): E.Effect<void, ServiceTypeError> =>
      wrapZomeCall('service_types', 'reject_service_type', serviceTypeHash);

    const getPendingServiceTypes = (): E.Effect<Record[], ServiceTypeError> =>
      wrapZomeCall('service_types', 'get_pending_service_types', null);

    const getApprovedServiceTypes = (): E.Effect<Record[], ServiceTypeError> =>
      wrapZomeCall('service_types', 'get_approved_service_types', null);

    const getRejectedServiceTypes = (): E.Effect<Record[], ServiceTypeError> =>
      wrapZomeCall('service_types', 'get_rejected_service_types', null);

    const getServiceTypeStatus = (
      serviceTypeHash: ActionHash
    ): E.Effect<string, ServiceTypeError> =>
      wrapZomeCall('service_types', 'get_service_type_status', serviceTypeHash);

    return ServiceTypesServiceTag.of({
      createServiceType,
      getServiceType,
      getLatestServiceTypeRecord,
      updateServiceType,
      deleteServiceType,
      getAllServiceTypes,
      getRequestsForServiceType,
      getOffersForServiceType,
      getUsersForServiceType,
      getServiceTypesForEntity,
      linkToServiceType,
      unlinkFromServiceType,
      updateServiceTypeLinks,
      deleteAllServiceTypeLinksForEntity,
      suggestServiceType,
      approveServiceType,
      rejectServiceType,
      getPendingServiceTypes,
      getApprovedServiceTypes,
      getRejectedServiceTypes,
      getServiceTypeStatus
    });
  })
);
