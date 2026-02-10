import { Schema } from 'effect';

export const AgentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  note: Schema.optional(Schema.String),
  revisionId: Schema.optional(Schema.String)
});

export const ResourceSpecificationSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  note: Schema.optional(Schema.String),
  classifiedAs: Schema.optional(Schema.Array(Schema.String)),
  revisionId: Schema.optional(Schema.String)
});

export const ProposalSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  note: Schema.optional(Schema.String),
  created: Schema.optional(Schema.String),
  eligible: Schema.optional(Schema.Array(Schema.String)), // Agent IDs
  revisionId: Schema.optional(Schema.String),
  hasBeginning: Schema.optional(Schema.String),
  hasEnd: Schema.optional(Schema.String),
  unitBased: Schema.optional(Schema.Boolean)
});

export const IntentSchema = Schema.Struct({
  id: Schema.String,
  action: Schema.String, // 'work', 'transfer', etc.
  provider: Schema.optional(Schema.String), // Agent ID
  receiver: Schema.optional(Schema.String), // Agent ID
  resourceSpecifiedBy: Schema.optional(Schema.String), // ResourceSpecification ID
  resourceQuantity: Schema.optional(
    Schema.Struct({
      hasNumericalValue: Schema.Number,
      hasUnit: Schema.String
    })
  ),
  revisionId: Schema.optional(Schema.String),
  note: Schema.optional(Schema.String)
});
