import { Schema } from 'effect';
import {
  ActionHashSchema,
  RecordSchema,
  AgentPubKeySchema,
  TimestampSchema
} from './holochain.schemas';
import { TimePreferenceSchema, InteractionTypeSchema } from './common.schemas';

/**
 * Offer schemas using Effect class-based approach
 */

// Core OfferInDHT schema matching OfferInDHT from Holochain
export class OfferInDHT extends Schema.Class<OfferInDHT>('OfferInDHT')({
  title: Schema.String.pipe(
    Schema.minLength(5),
    Schema.maxLength(200),
    Schema.annotations({
      title: 'Offer Title',
      description: 'The title of the offer'
    })
  ),
  description: Schema.String.pipe(
    Schema.minLength(20),
    Schema.maxLength(1000),
    Schema.annotations({
      title: 'Offer Description',
      description: 'Detailed description of what is being offered'
    })
  ),
  time_preference: TimePreferenceSchema.pipe(
    Schema.annotations({
      title: 'Time Preference',
      description: 'Preferred time for the interaction'
    })
  ),
  time_zone: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        title: 'Time Zone',
        description: 'Time zone for the offer'
      })
    )
  ),
  interaction_type: InteractionTypeSchema.pipe(
    Schema.annotations({
      title: 'Interaction Type',
      description: 'Type of interaction (Virtual or InPerson)'
    })
  ),
  links: Schema.Array(Schema.String).pipe(
    Schema.annotations({
      title: 'Links',
      description: 'Additional links related to the offer'
    })
  )
}) {}

// OfferInput schema for creation/updates (includes linking data)
export class OfferInput extends Schema.Class<OfferInput>('OfferInput')({
  // Core offer fields
  title: Schema.String.pipe(Schema.minLength(5), Schema.maxLength(200)),
  description: Schema.String.pipe(Schema.minLength(20), Schema.maxLength(2000)),
  time_preference: TimePreferenceSchema,
  time_zone: Schema.optional(Schema.String),
  interaction_type: InteractionTypeSchema,
  links: Schema.Array(Schema.String),

  // Linking fields
  service_type_hashes: Schema.Array(ActionHashSchema).pipe(
    Schema.annotations({
      title: 'Service Type Hashes',
      description: 'Hashes of associated service types'
    })
  ),
  medium_of_exchange_hashes: Schema.Array(ActionHashSchema).pipe(
    Schema.annotations({
      title: 'Medium of Exchange Hashes',
      description: 'Hashes of associated mediums of exchange'
    })
  ),
  organization: Schema.optional(
    ActionHashSchema.pipe(
      Schema.annotations({
        title: 'Organization',
        description: 'Optional organization hash'
      })
    )
  )
}) {}

// UI Offer schema with additional UI-specific fields
export class UIOffer extends Schema.Class<UIOffer>('UIOffer')({
  // Core offer fields
  title: Schema.String.pipe(Schema.minLength(5), Schema.maxLength(200)),
  description: Schema.String.pipe(Schema.minLength(20), Schema.maxLength(2000)),
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

  // Associated data
  service_type_hashes: Schema.optional(Schema.Array(ActionHashSchema)),
  medium_of_exchange_hashes: Schema.optional(Schema.Array(ActionHashSchema))
}) {}

// Input classes for offer operations
export class CreateOfferInput extends Schema.Class<CreateOfferInput>('CreateOfferInput')({
  offer: OfferInDHT,
  organization: Schema.optional(ActionHashSchema),
  service_type_hashes: Schema.Array(ActionHashSchema),
  medium_of_exchange_hashes: Schema.Array(ActionHashSchema)
}) {}

export class UpdateOfferInput extends Schema.Class<UpdateOfferInput>('UpdateOfferInput')({
  original_action_hash: ActionHashSchema,
  previous_action_hash: ActionHashSchema,
  updated_offer: OfferInDHT,
  service_type_hashes: Schema.Array(ActionHashSchema),
  medium_of_exchange_hashes: Schema.Array(ActionHashSchema)
}) {}

export class GetMediumsOfExchangeForOfferInput extends Schema.Class<GetMediumsOfExchangeForOfferInput>(
  'GetMediumsOfExchangeForOfferInput'
)({
  original_action_hash: ActionHashSchema,
  entity: Schema.Literal('offer')
}) {}

// Response schemas for service validation
export const OfferRecordSchema = RecordSchema;
export const OfferRecordOrNullSchema = Schema.NullOr(OfferRecordSchema);
export const OfferRecordsArraySchema = Schema.Array(OfferRecordSchema);
export const ActionHashArraySchema = Schema.Array(ActionHashSchema);
export const StringArraySchema = Schema.Array(Schema.String);
export const BooleanResponseSchema = Schema.Boolean;
export const VoidResponseSchema = Schema.Void;

// Branded input schemas
export const CreateOfferInputSchema = CreateOfferInput.pipe(Schema.brand('CreateOfferInput'));
export const UpdateOfferInputSchema = UpdateOfferInput.pipe(Schema.brand('UpdateOfferInput'));

// Legacy type exports for backward compatibility (these will be removed after refactoring)
export type OfferType = Schema.Schema.Type<typeof OfferInDHT>;
export type OfferInputType = Schema.Schema.Type<typeof OfferInput>;
export type UIOfferType = Schema.Schema.Type<typeof UIOffer>;
export type CreateOfferInputType = Schema.Schema.Type<typeof CreateOfferInput>;
export type UpdateOfferInputType = Schema.Schema.Type<typeof UpdateOfferInput>;
export type GetMediumsOfExchangeForOfferInputType = Schema.Schema.Type<
  typeof GetMediumsOfExchangeForOfferInput
>;
