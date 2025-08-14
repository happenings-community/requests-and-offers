import { Schema } from 'effect';
import {
  ActionHashSchema,
  RecordSchema,
  AgentPubKeySchema,
  TimestampSchema
} from './holochain.schemas';

/**
 * Service Type schemas using Effect class-based approach
 */

// Core ServiceType schema matching ServiceTypeInDHT from Holochain
export class ServiceTypeInDHT extends Schema.Class<ServiceTypeInDHT>('ServiceTypeInDHT')({
  name: Schema.String.pipe(
    Schema.minLength(2),
    Schema.maxLength(100),
    Schema.annotations({
      title: 'Service Type Name',
      description: 'The name of the service type'
    })
  ),
  description: Schema.String.pipe(
    Schema.minLength(10),
    Schema.maxLength(500),
    Schema.annotations({
      title: 'Service Type Description',
      description: 'Detailed description of the service type'
    })
  ),
  technical: Schema.Boolean.pipe(
    Schema.annotations({
      title: 'Technical Service',
      description: 'Whether this is a technical service (true) or non-technical service (false)'
    })
  )
}) {}

export class UpdateServiceTypeInput extends Schema.Class<UpdateServiceTypeInput>(
  'UpdateServiceTypeInput'
)({
  original_action_hash: ActionHashSchema,
  previous_action_hash: ActionHashSchema,
  updated_service_type: ServiceTypeInDHT
}) {}

// UI ServiceType schema with additional UI-specific fields
export class UIServiceType extends Schema.Class<UIServiceType>('UIServiceType')({
  // Core ServiceType fields
  name: Schema.String.pipe(Schema.minLength(2), Schema.maxLength(100)),
  description: Schema.String.pipe(Schema.minLength(10), Schema.maxLength(500)),
  technical: Schema.Boolean,

  // UI-specific fields
  original_action_hash: Schema.optional(ActionHashSchema),
  previous_action_hash: Schema.optional(ActionHashSchema),
  creator: Schema.optional(AgentPubKeySchema),
  created_at: Schema.optional(TimestampSchema),
  updated_at: Schema.optional(TimestampSchema),
  status: Schema.Literal('pending', 'approved', 'rejected').pipe(
    Schema.annotations({
      title: 'Service Type Status',
      description: 'The approval status of the service type'
    })
  )
}) {}

// Input classes for service operations
export class ServiceTypeLinkInput extends Schema.Class<ServiceTypeLinkInput>(
  'ServiceTypeLinkInput'
)({
  service_type_hash: ActionHashSchema,
  action_hash: ActionHashSchema,
  entity: Schema.Literal('request', 'offer', 'user')
}) {}

export class UpdateServiceTypeLinksInput extends Schema.Class<UpdateServiceTypeLinksInput>(
  'UpdateServiceTypeLinksInput'
)({
  action_hash: ActionHashSchema,
  entity: Schema.Literal('request', 'offer', 'user'),
  new_service_type_hashes: Schema.Array(ActionHashSchema)
}) {}

export class GetServiceTypeForEntityInput extends Schema.Class<GetServiceTypeForEntityInput>(
  'GetServiceTypeForEntityInput'
)({
  original_action_hash: ActionHashSchema,
  entity: Schema.Literal('request', 'offer', 'user')
}) {}

// Response classes
export class ServiceTypesCollection extends Schema.Class<ServiceTypesCollection>(
  'ServiceTypesCollection'
)({
  pending: Schema.Array(RecordSchema),
  approved: Schema.Array(RecordSchema),
  rejected: Schema.Array(RecordSchema)
}) {}

// TagStatistics class removed as tags functionality has been removed

// Output schemas for service validation
export const ServiceTypeRecordSchema = RecordSchema;
export const ServiceTypeRecordOrNullSchema = Schema.NullOr(ServiceTypeRecordSchema);
export const ServiceTypeRecordsArraySchema = Schema.Array(ServiceTypeRecordSchema);
export const ActionHashArraySchema = Schema.Array(ActionHashSchema);
export const StringArraySchema = Schema.Array(Schema.String);
// TagStatisticsArraySchema removed as tags functionality has been removed
export const VoidResponseSchema = Schema.Void;
export const UpdateServiceTypeInputSchema = UpdateServiceTypeInput.pipe(
  Schema.brand('UpdateServiceTypeInput')
);

// Legacy type exports for backward compatibility (these will be removed after refactoring)
export type ServiceType = Schema.Schema.Type<typeof ServiceTypeInDHT>;
export type ServiceTypeLinkInputType = Schema.Schema.Type<typeof ServiceTypeLinkInput>;
export type UpdateServiceTypeLinksInputType = Schema.Schema.Type<
  typeof UpdateServiceTypeLinksInput
>;
export type GetServiceTypeForEntityInputType = Schema.Schema.Type<
  typeof GetServiceTypeForEntityInput
>;
export type ServiceTypesCollectionType = Schema.Schema.Type<typeof ServiceTypesCollection>;
// TagStatisticsType removed as tags functionality has been removed
