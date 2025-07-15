import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { Effect as E, Layer, Context, pipe, Schema } from 'effect';
import { ServiceTypeError } from '$lib/errors/service-types.errors';
import { SERVICE_TYPE_CONTEXTS } from '$lib/errors/error-contexts';

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
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.CREATE_SERVICE_TYPE));
        })
      );

    const getServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<Record | null, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'get_service_type', serviceTypeHash),
        E.map((result) => result as Record | null),
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_SERVICE_TYPE));
        })
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
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_LATEST_SERVICE_TYPE_RECORD));
        })
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
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.UPDATE_SERVICE_TYPE));
        })
      );

    const deleteServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<ActionHash, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'delete_service_type', serviceTypeHash),
        E.map((result) => result as ActionHash),
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.DELETE_SERVICE_TYPE));
        })
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
              message: `${SERVICE_TYPE_CONTEXTS.GET_ALL_SERVICE_TYPES}: ${String(error)}`,
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
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_REQUESTS_FOR_SERVICE_TYPE));
        })
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
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_OFFERS_FOR_SERVICE_TYPE));
        })
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
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_USERS_FOR_SERVICE_TYPE));
        })
      );

    const getServiceTypesForEntity = (
      input: GetServiceTypeForEntityInput
    ): E.Effect<ActionHash[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'get_service_types_for_entity', input),
        E.map((hashes) => hashes as ActionHash[]),
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_SERVICE_TYPES_FOR_ENTITY));
        })
      );

    const linkToServiceType = (input: ServiceTypeLinkInput): E.Effect<void, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeEffect(
          'service_types',
          'link_to_service_type',
          input,
          VoidResponseSchema
        ),
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.LINK_TO_SERVICE_TYPE));
        })
      );

    const unlinkFromServiceType = (input: ServiceTypeLinkInput): E.Effect<void, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeEffect(
          'service_types',
          'unlink_from_service_type',
          input,
          VoidResponseSchema
        ),
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.UNLINK_FROM_SERVICE_TYPE));
        })
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
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.UPDATE_SERVICE_TYPE_LINKS));
        })
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
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(
            ServiceTypeError.fromError(
              error,
              SERVICE_TYPE_CONTEXTS.DELETE_ALL_SERVICE_TYPE_LINKS_FOR_ENTITY
            )
          );
        })
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
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.SUGGEST_SERVICE_TYPE));
        })
      );

    const approveServiceType = (serviceTypeHash: ActionHash): E.Effect<void, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeEffect(
          'service_types',
          'approve_service_type',
          serviceTypeHash,
          VoidResponseSchema
        ),
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.APPROVE_SERVICE_TYPE));
        })
      );

    const rejectServiceType = (serviceTypeHash: ActionHash): E.Effect<void, ServiceTypeError> =>
      pipe(
        holochainClient.callZomeEffect(
          'service_types',
          'reject_service_type',
          serviceTypeHash,
          VoidResponseSchema
        ),
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.REJECT_SERVICE_TYPE));
        })
      );

    const getPendingServiceTypes = (): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'get_pending_service_types', null),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_PENDING_SERVICE_TYPES));
        })
      );

    const getApprovedServiceTypes = (): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'get_approved_service_types', null),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_APPROVED_SERVICE_TYPES));
        })
      );

    const getRejectedServiceTypes = (): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'get_rejected_service_types', null),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_REJECTED_SERVICE_TYPES));
        })
      );

    // Tag-related method implementations
    const getServiceTypesByTag = (tag: string): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'get_service_types_by_tag', tag),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_SERVICE_TYPES_BY_TAG));
        })
      );

    const getServiceTypesByTags = (tags: string[]): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect('service_types', 'get_service_types_by_tags', tags),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_SERVICE_TYPES_BY_TAGS));
        })
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
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_ALL_SERVICE_TYPE_TAGS));
        })
      );

    const searchServiceTypesByTagPrefix = (prefix: string): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'service_types',
          'search_service_types_by_tag_prefix',
          prefix
        ),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(
            ServiceTypeError.fromError(
              error,
              SERVICE_TYPE_CONTEXTS.SEARCH_SERVICE_TYPES_BY_TAG_PREFIX
            )
          );
        })
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
        E.catchAll((error) => {
          if (error instanceof ServiceTypeError) {
            return E.fail(error);
          }
          return E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_TAG_STATISTICS));
        })
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
