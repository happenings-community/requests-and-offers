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
