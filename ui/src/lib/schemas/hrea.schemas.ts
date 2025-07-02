import { Schema } from 'effect';

export const AgentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  note: Schema.String,
  revisionId: Schema.optional(Schema.String)
});
