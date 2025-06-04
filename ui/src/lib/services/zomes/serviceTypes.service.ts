import type { ActionHash, Record } from '@holochain/client';
import { type ServiceTypeInDHT } from '$lib/types/holochain';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { Effect as E, Layer, Context, Data, pipe } from 'effect';

// --- Error Types ---

export class ServiceTypeError extends Data.TaggedError('ServiceTypeError')<{
  message: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): ServiceTypeError {
    if (error instanceof Error) {
      return new ServiceTypeError({
        message: `${context}: ${error.message}`,
        cause: error
      });
    }
    return new ServiceTypeError({
      message: `${context}: ${String(error)}`,
      cause: error
    });
  }
}

// --- Input Types ---

export type ServiceTypeLinkInput = {
  service_type_hash: ActionHash;
  action_hash: ActionHash;
  entity: 'request' | 'offer' | 'user';
};

export type UpdateServiceTypeLinksInput = {
  action_hash: ActionHash;
  entity: 'request' | 'offer' | 'user';
  new_service_type_hashes: ActionHash[];
};

export type GetServiceTypeForEntityInput = {
  original_action_hash: ActionHash;
  entity: 'request' | 'offer' | 'user';
};

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

  readonly getAllServiceTypes: () => E.Effect<Record[], ServiceTypeError>;

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
        E.tryPromise({
          try: () =>
            holochainClient.callZome('service_types', 'create_service_type', {
              service_type: serviceType
            }),
          catch: (error: unknown) =>
            ServiceTypeError.fromError(error, 'Failed to create service type')
        }),
        E.map((record: unknown) => record as Record)
      );

    const getServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<Record | null, ServiceTypeError> =>
      pipe(
        E.tryPromise({
          try: () => holochainClient.callZome('service_types', 'get_service_type', serviceTypeHash),
          catch: (error: unknown) => ServiceTypeError.fromError(error, 'Failed to get service type')
        }),
        E.map((record: unknown) => record as Record | null)
      );

    const getLatestServiceTypeRecord = (
      originalActionHash: ActionHash
    ): E.Effect<Record | null, ServiceTypeError> =>
      pipe(
        E.tryPromise({
          try: () =>
            holochainClient.callZome(
              'service_types',
              'get_latest_service_type_record',
              originalActionHash
            ),
          catch: (error: unknown) =>
            ServiceTypeError.fromError(error, 'Failed to get latest service type record')
        }),
        E.map((record: unknown) => record as Record | null)
      );

    const updateServiceType = (
      originalServiceTypeHash: ActionHash,
      previousServiceTypeHash: ActionHash,
      updatedServiceType: ServiceTypeInDHT
    ): E.Effect<ActionHash, ServiceTypeError> =>
      pipe(
        E.tryPromise({
          try: () =>
            holochainClient.callZome('service_types', 'update_service_type', {
              original_service_type_hash: originalServiceTypeHash,
              previous_service_type_hash: previousServiceTypeHash,
              updated_service_type: updatedServiceType
            }),
          catch: (error: unknown) =>
            ServiceTypeError.fromError(error, 'Failed to update service type')
        }),
        E.map((actionHash: unknown) => actionHash as ActionHash)
      );

    const deleteServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<ActionHash, ServiceTypeError> =>
      pipe(
        E.tryPromise({
          try: () =>
            holochainClient.callZome('service_types', 'delete_service_type', serviceTypeHash),
          catch: (error: unknown) =>
            ServiceTypeError.fromError(error, 'Failed to delete service type')
        }),
        E.map((actionHash: unknown) => actionHash as ActionHash)
      );

    const getAllServiceTypes = (): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        E.tryPromise({
          try: () => holochainClient.callZome('service_types', 'get_all_service_types', null),
          catch: (error: unknown) =>
            ServiceTypeError.fromError(error, 'Failed to get all service types')
        }),
        E.map((records: unknown) => records as Record[])
      );

    const getRequestsForServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        E.tryPromise({
          try: () =>
            holochainClient.callZome(
              'service_types',
              'get_requests_for_service_type',
              serviceTypeHash
            ),
          catch: (error: unknown) =>
            ServiceTypeError.fromError(error, 'Failed to get requests for service type')
        }),
        E.map((records: unknown) => records as Record[])
      );

    const getOffersForServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        E.tryPromise({
          try: () =>
            holochainClient.callZome(
              'service_types',
              'get_offers_for_service_type',
              serviceTypeHash
            ),
          catch: (error: unknown) =>
            ServiceTypeError.fromError(error, 'Failed to get offers for service type')
        }),
        E.map((records: unknown) => records as Record[])
      );

    const getUsersForServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<Record[], ServiceTypeError> =>
      pipe(
        E.tryPromise({
          try: () =>
            holochainClient.callZome(
              'service_types',
              'get_users_for_service_type',
              serviceTypeHash
            ),
          catch: (error: unknown) =>
            ServiceTypeError.fromError(error, 'Failed to get users for service type')
        }),
        E.map((records: unknown) => records as Record[])
      );

    const getServiceTypesForEntity = (
      input: GetServiceTypeForEntityInput
    ): E.Effect<ActionHash[], ServiceTypeError> =>
      pipe(
        E.tryPromise({
          try: () =>
            holochainClient.callZome('service_types', 'get_service_types_for_entity', input),
          catch: (error: unknown) =>
            ServiceTypeError.fromError(error, 'Failed to get service types for entity')
        }),
        E.map((hashes: unknown) => hashes as ActionHash[])
      );

    const linkToServiceType = (input: ServiceTypeLinkInput): E.Effect<void, ServiceTypeError> =>
      pipe(
        E.tryPromise({
          try: () => holochainClient.callZome('service_types', 'link_to_service_type', input),
          catch: (error: unknown) =>
            ServiceTypeError.fromError(error, 'Failed to link to service type')
        }),
        E.map(() => void 0)
      );

    const unlinkFromServiceType = (input: ServiceTypeLinkInput): E.Effect<void, ServiceTypeError> =>
      pipe(
        E.tryPromise({
          try: () => holochainClient.callZome('service_types', 'unlink_from_service_type', input),
          catch: (error: unknown) =>
            ServiceTypeError.fromError(error, 'Failed to unlink from service type')
        }),
        E.map(() => void 0)
      );

    const updateServiceTypeLinks = (
      input: UpdateServiceTypeLinksInput
    ): E.Effect<void, ServiceTypeError> =>
      pipe(
        E.tryPromise({
          try: () => holochainClient.callZome('service_types', 'update_service_type_links', input),
          catch: (error: unknown) =>
            ServiceTypeError.fromError(error, 'Failed to update service type links')
        }),
        E.map(() => void 0)
      );

    const deleteAllServiceTypeLinksForEntity = (
      input: GetServiceTypeForEntityInput
    ): E.Effect<void, ServiceTypeError> =>
      pipe(
        E.tryPromise({
          try: () =>
            holochainClient.callZome(
              'service_types',
              'delete_all_service_type_links_for_entity',
              input
            ),
          catch: (error: unknown) =>
            ServiceTypeError.fromError(error, 'Failed to delete all service type links for entity')
        }),
        E.map(() => void 0)
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
      deleteAllServiceTypeLinksForEntity
    });
  })
);
