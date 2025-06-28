import { Schema } from 'effect';

export const AgentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  note: Schema.String
});
