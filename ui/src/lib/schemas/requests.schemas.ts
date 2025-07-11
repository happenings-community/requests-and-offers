import { Schema } from 'effect';
import {
  ActionHashSchema,
  RecordSchema,
  AgentPubKeySchema,
  TimestampSchema
} from './holochain.schemas';
import {
  ContactPreferenceSchema,
  TimePreferenceSchema,
  InteractionTypeSchema,
  DateRangeSchema
} from './common.schemas';

/**
 * Request schemas using Effect class-based approach following Service Types patterns
 */

// Core Request schema matching RequestInDHT from Holochain
export class RequestInDHT extends Schema.Class<RequestInDHT>('RequestInDHT')({
  title: Schema.String.pipe(
    Schema.minLength(3),
    Schema.maxLength(100),
    Schema.annotations({
      title: 'Request Title',
      description: 'The title of the request'
    })
  ),
  description: Schema.String.pipe(
    Schema.minLength(10),
    Schema.maxLength(1000),
    Schema.annotations({
      title: 'Request Description',
      description: 'Detailed description of the request'
    })
  ),
  contact_preference: ContactPreferenceSchema,
  date_range: Schema.optional(DateRangeSchema),
  time_estimate_hours: Schema.optional(Schema.Number.pipe(Schema.positive())),
  time_preference: TimePreferenceSchema,
  time_zone: Schema.optional(Schema.String),
  interaction_type: InteractionTypeSchema,
  links: Schema.Array(Schema.String).pipe(
    Schema.annotations({
      title: 'Request Links',
      description: 'URLs related to the request'
    })
  )
}) {}

// Input schema for creating requests (includes service type hashes)
export class RequestInput extends Schema.Class<RequestInput>('RequestInput')({
  title: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(100)),
  description: Schema.String.pipe(Schema.minLength(10), Schema.maxLength(1000)),
  contact_preference: ContactPreferenceSchema,
  date_range: Schema.optional(DateRangeSchema),
  time_estimate_hours: Schema.optional(Schema.Number.pipe(Schema.positive())),
  time_preference: TimePreferenceSchema,
  time_zone: Schema.optional(Schema.String),
  interaction_type: InteractionTypeSchema,
  links: Schema.Array(Schema.String),
  service_type_hashes: Schema.Array(ActionHashSchema).pipe(
    Schema.annotations({
      title: 'Service Type Hashes',
      description: 'Associated service type hashes for the request'
    })
  ),
  medium_of_exchange_hashes: Schema.Array(ActionHashSchema).pipe(
    Schema.annotations({
      title: 'Medium of Exchange Hashes',
      description: 'Associated medium of exchange hashes for the request'
    })
  )
}) {}

// UI Request schema with additional UI-specific fields
export class UIRequest extends Schema.Class<UIRequest>('UIRequest')({
  // Core Request fields
  title: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(100)),
  description: Schema.String.pipe(Schema.minLength(10), Schema.maxLength(1000)),
  contact_preference: ContactPreferenceSchema,
  date_range: Schema.optional(DateRangeSchema),
  time_estimate_hours: Schema.optional(Schema.Number.pipe(Schema.positive())),
  time_preference: TimePreferenceSchema,
  time_zone: Schema.optional(Schema.String),
  interaction_type: InteractionTypeSchema,
  links: Schema.Array(Schema.String),

  // UI-specific fields
  original_action_hash: Schema.optional(ActionHashSchema),
  previous_action_hash: Schema.optional(ActionHashSchema),
  creator: Schema.optional(AgentPubKeySchema),
  organization: Schema.optional(ActionHashSchema),
  created_at: Schema.optional(TimestampSchema),
  updated_at: Schema.optional(TimestampSchema),
  service_type_hashes: Schema.Array(ActionHashSchema),
  medium_of_exchange_hashes: Schema.Array(ActionHashSchema)
}) {}

// Service operation schemas
export class GetRequestsByUserInput extends Schema.Class<GetRequestsByUserInput>(
  'GetRequestsByUserInput'
)({
  user_hash: ActionHashSchema
}) {}

export class GetRequestsByOrganizationInput extends Schema.Class<GetRequestsByOrganizationInput>(
  'GetRequestsByOrganizationInput'
)({
  organization_hash: ActionHashSchema
}) {}

export class UpdateRequestInput extends Schema.Class<UpdateRequestInput>('UpdateRequestInput')({
  original_action_hash: ActionHashSchema,
  previous_action_hash: ActionHashSchema,
  updated_request: RequestInput
}) {}

// Output schemas for service validation following Service Types patterns
export const RequestRecordSchema = RecordSchema;
export const RequestRecordOrNullSchema = Schema.NullOr(RequestRecordSchema);
export const RequestRecordsArraySchema = Schema.Array(RequestRecordSchema);
export const BooleanResponseSchema = Schema.Boolean;
// Note: VoidResponseSchema is already exported from service-types.schemas.ts

// Legacy type exports for backward compatibility (these will be removed after refactoring)
export type RequestType = Schema.Schema.Type<typeof RequestInDHT>;
export type RequestInputType = Schema.Schema.Type<typeof RequestInput>;
export type UIRequestType = Schema.Schema.Type<typeof UIRequest>;
export type GetRequestsByUserInputType = Schema.Schema.Type<typeof GetRequestsByUserInput>;
export type GetRequestsByOrganizationInputType = Schema.Schema.Type<
  typeof GetRequestsByOrganizationInput
>;
export type UpdateRequestInputType = Schema.Schema.Type<typeof UpdateRequestInput>;
