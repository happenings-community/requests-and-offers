import { Schema } from 'effect';

// Base Holochain types
export const AgentPubKeySchema = Schema.String.pipe(
  Schema.brand('AgentPubKey'),
  Schema.annotations({
    title: 'Agent Public Key',
    description: 'A Holochain agent public key'
  })
);

export const ActionHashSchema = Schema.String.pipe(
  Schema.brand('ActionHash'),
  Schema.annotations({
    title: 'Action Hash',
    description: 'A Holochain action hash'
  })
);

export const EntryHashSchema = Schema.String.pipe(
  Schema.brand('EntryHash'),
  Schema.annotations({
    title: 'Entry Hash',
    description: 'A Holochain entry hash'
  })
);

export const DnaHashSchema = Schema.String.pipe(
  Schema.brand('DnaHash'),
  Schema.annotations({
    title: 'DNA Hash',
    description: 'A Holochain DNA hash'
  })
);

export const TimestampSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand('Timestamp'),
  Schema.annotations({
    title: 'Timestamp',
    description: 'A Unix timestamp in microseconds'
  })
);

// Holochain Record schema
export const RecordSchema = Schema.Struct({
  signed_action: Schema.Struct({
    hashed: Schema.Struct({
      content: Schema.Struct({
        type: Schema.Literal('Create', 'Update', 'Delete'),
        timestamp: TimestampSchema,
        author: AgentPubKeySchema,
        prev_action: ActionHashSchema.pipe(Schema.optional),
        action_seq: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
        entry_type: Schema.optional(Schema.String),
        entry_hash: Schema.optional(EntryHashSchema)
      }),
      hash: ActionHashSchema
    }),
    signature: Schema.String
  }),
  entry: Schema.optional(
    Schema.Struct({
      Present: Schema.Unknown
    })
  )
}).pipe(
  Schema.annotations({
    title: 'Holochain Record',
    description: 'A complete Holochain record with signed action and optional entry'
  })
);

// Link schema
export const LinkSchema = Schema.Struct({
  author: AgentPubKeySchema,
  timestamp: TimestampSchema,
  action_hash: ActionHashSchema,
  base: EntryHashSchema,
  target: EntryHashSchema,
  zome_index: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  link_type: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  tag: Schema.String,
  create_link_hash: ActionHashSchema
}).pipe(
  Schema.annotations({
    title: 'Holochain Link',
    description: 'A Holochain link between two entries'
  })
);

// Export branded types
export type AgentPubKey = Schema.Schema.Type<typeof AgentPubKeySchema>;
export type ActionHash = Schema.Schema.Type<typeof ActionHashSchema>;
export type EntryHash = Schema.Schema.Type<typeof EntryHashSchema>;
export type DnaHash = Schema.Schema.Type<typeof DnaHashSchema>;
export type Timestamp = Schema.Schema.Type<typeof TimestampSchema>;
export type HolochainRecord = Schema.Schema.Type<typeof RecordSchema>;
export type HolochainLink = Schema.Schema.Type<typeof LinkSchema>;
