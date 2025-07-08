import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { Effect as E, Layer, Context, pipe, Schema } from 'effect';
import { ServiceTypeError } from '$lib/errors/service-types.errors';

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
  TagStatisticsArraySchema,
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
  TagStatisticsArraySchema,
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

  // Tag-related methods
  readonly getServiceTypesByTag: (tag: string) => E.Effect<Record[], ServiceTypeError>;

  readonly getServiceTypesByTags: (tags: string[]) => E.Effect<Record[], ServiceTypeError>;

  readonly getAllServiceTypeTags: () => E.Effect<string[], ServiceTypeError>;

  readonly searchServiceTypesByTagPrefix: (prefix: string) => E.Effect<Record[], ServiceTypeError>;

  readonly getTagStatistics: () => E.Effect<Array<[string, number]>, ServiceTypeError>;
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
  E.gen(function* ($) {
    const holochainClient = yield* $(HolochainClientServiceTag);

    const createServiceType = (serviceType: ServiceTypeInDHT): E.Effect<Record, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'create_service_type', {
          service_type: serviceType
        }),
        E.map((result) => result as Record),
        E.mapError((error) => ServiceTypeError.fromError(error, 'Failed to create service type'))
      );

    const getServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<Record | null, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'get_service_type', serviceTypeHash),
        E.map((result) => result as Record | null),
        E.mapError((error) => ServiceTypeError.fromError(error, 'Failed to get service type'))
      );

    const getLatestServiceTypeRecord = (
      originalActionHash: ActionHash
    ): E.Effect<Record | null, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'service_types',
          'get_latest_service_type_record',
          originalActionHash
        ),
        E.map((result) => result as Record | null),
        E.mapError((error) =>
          ServiceTypeError.fromError(error, 'Failed to get latest service type record')
        )
      );

    const updateServiceType = (
      originalServiceTypeHash: ActionHash,
      previousServiceTypeHash: ActionHash,
      updatedServiceType: ServiceTypeInDHT
    ): E.Effect<ActionHash, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'update_service_type', {
          original_service_type_hash: originalServiceTypeHash,
          previous_service_type_hash: previousServiceTypeHash,
          updated_service_type: updatedServiceType
        }),
        E.map((result) => result as ActionHash),
        E.mapError((error) => ServiceTypeError.fromError(error, 'Failed to update service type'))
      );

    const deleteServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<ActionHash, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'delete_service_type', serviceTypeHash),
        E.map((result) => result as ActionHash),
        E.mapError((error) => ServiceTypeError.fromError(error, 'Failed to delete service type'))
      );

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
              message: `Failed to get all service types: ${String(error)}`,
              cause: error
            })
          );
        })
      );

    const getRequestsForServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'service_types',
          'get_requests_for_service_type',
          serviceTypeHash
        ),
        E.map((records) => records as Record[]),
        E.mapError((error) =>
          ServiceTypeError.fromError(error, 'Failed to get requests for service type')
        )
      );

    const getOffersForServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'service_types',
          'get_offers_for_service_type',
          serviceTypeHash
        ),
        E.map((records) => records as Record[]),
        E.mapError((error) =>
          ServiceTypeError.fromError(error, 'Failed to get offers for service type')
        )
      );

    const getUsersForServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'service_types',
          'get_users_for_service_type',
          serviceTypeHash
        ),
        E.map((records) => records as Record[]),
        E.mapError((error) =>
          ServiceTypeError.fromError(error, 'Failed to get users for service type')
        )
      );

    const getServiceTypesForEntity = (
      input: GetServiceTypeForEntityInput
    ): E.Effect<ActionHash[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'get_service_types_for_entity', input),
        E.map((hashes) => hashes as ActionHash[]),
        E.mapError((error) =>
          ServiceTypeError.fromError(error, 'Failed to get service types for entity')
        )
      );

    const linkToServiceType = (input: ServiceTypeLinkInput): E.Effect<void, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeEffect(
          'service_types',
          'link_to_service_type',
          input,
          VoidResponseSchema
        ),
        E.mapError((error) => ServiceTypeError.fromError(error, 'Failed to link to service type'))
      );

    const unlinkFromServiceType = (input: ServiceTypeLinkInput): E.Effect<void, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeEffect(
          'service_types',
          'unlink_from_service_type',
          input,
          VoidResponseSchema
        ),
        E.mapError((error) =>
          ServiceTypeError.fromError(error, 'Failed to unlink from service type')
        )
      );

    const updateServiceTypeLinks = (
      input: UpdateServiceTypeLinksInput
    ): E.Effect<void, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeEffect(
          'service_types',
          'update_service_type_links',
          input,
          VoidResponseSchema
        ),
        E.mapError((error) =>
          ServiceTypeError.fromError(error, 'Failed to update service type links')
        )
      );

    const deleteAllServiceTypeLinksForEntity = (
      input: GetServiceTypeForEntityInput
    ): E.Effect<void, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeEffect(
          'service_types',
          'delete_all_service_type_links_for_entity',
          input,
          VoidResponseSchema
        ),
        E.mapError((error) =>
          ServiceTypeError.fromError(error, 'Failed to delete all service type links for entity')
        )
      );

    // Status management method implementations
    const suggestServiceType = (
      serviceType: ServiceTypeInDHT
    ): E.Effect<Record, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'suggest_service_type', {
          service_type: serviceType
        }),
        E.map((result) => result as Record),
        E.mapError((error) => ServiceTypeError.fromError(error, 'Failed to suggest service type'))
      );

    const approveServiceType = (serviceTypeHash: ActionHash): E.Effect<void, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeEffect(
          'service_types',
          'approve_service_type',
          serviceTypeHash,
          VoidResponseSchema
        ),
        E.mapError((error) => ServiceTypeError.fromError(error, 'Failed to approve service type'))
      );

    const rejectServiceType = (serviceTypeHash: ActionHash): E.Effect<void, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeEffect(
          'service_types',
          'reject_service_type',
          serviceTypeHash,
          VoidResponseSchema
        ),
        E.mapError((error) => ServiceTypeError.fromError(error, 'Failed to reject service type'))
      );

    const getPendingServiceTypes = (): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'get_pending_service_types', null),
        E.map((records) => records as Record[]),
        E.mapError((error) =>
          ServiceTypeError.fromError(error, 'Failed to get pending service types')
        )
      );

    const getApprovedServiceTypes = (): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'get_approved_service_types', null),
        E.map((records) => records as Record[]),
        E.mapError((error) =>
          ServiceTypeError.fromError(error, 'Failed to get approved service types')
        )
      );

    const getRejectedServiceTypes = (): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'get_rejected_service_types', null),
        E.map((records) => records as Record[]),
        E.mapError((error) =>
          ServiceTypeError.fromError(error, 'Failed to get rejected service types')
        )
      );

    // Tag-related method implementations
    const getServiceTypesByTag = (tag: string): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'get_service_types_by_tag', tag),
        E.map((records) => records as Record[]),
        E.mapError((error) =>
          ServiceTypeError.fromError(error, 'Failed to get service types by tag')
        )
      );

    const getServiceTypesByTags = (tags: string[]): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'get_service_types_by_tags', tags),
        E.map((records) => records as Record[]),
        E.mapError((error) =>
          ServiceTypeError.fromError(error, 'Failed to get service types by tags')
        )
      );

    const getAllServiceTypeTags = (): E.Effect<string[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeEffect(
          'service_types',
          'get_all_service_type_tags',
          null,
          StringArraySchema
        ),
        E.map((validatedTags) => validatedTags as string[]),
        E.mapError((error) =>
          ServiceTypeError.fromError(error, 'Failed to get all service type tags')
        )
      );

    const searchServiceTypesByTagPrefix = (prefix: string): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'service_types',
          'search_service_types_by_tag_prefix',
          prefix
        ),
        E.map((records) => records as Record[]),
        E.mapError((error) =>
          ServiceTypeError.fromError(error, 'Failed to search service types by tag prefix')
        )
      );

    const getTagStatistics = (): E.Effect<Array<[string, number]>, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeEffect(
          'service_types',
          'get_tag_statistics',
          null,
          TagStatisticsArraySchema
        ),
        E.map((validatedStats) => validatedStats as Array<[string, number]>),
        E.mapError((error) => ServiceTypeError.fromError(error, 'Failed to get tag statistics'))
      );

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
      getServiceTypesByTag,
      getServiceTypesByTags,
      getAllServiceTypeTags,
      searchServiceTypesByTagPrefix,
      getTagStatistics
    });
  })
);
