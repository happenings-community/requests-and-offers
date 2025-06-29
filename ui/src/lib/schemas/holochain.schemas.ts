import { Schema } from 'effect';
import {
  type ActionHash as HolochainActionHash,
  type EntryHash as HolochainEntryHash,
  type AgentPubKey as HolochainAgentPubKey
} from '@holochain/client';

// Base Holochain types
export const AgentPubKeySchema = Schema.instanceOf(
  Uint8Array
) as Schema.Schema<HolochainAgentPubKey>;
export const ActionHashSchema = Schema.instanceOf(Uint8Array) as Schema.Schema<HolochainActionHash>;
export const EntryHashSchema = Schema.instanceOf(Uint8Array) as Schema.Schema<HolochainEntryHash>;

export const DnaHashSchema = Schema.String.pipe(
  Schema.brand('DnaHash'),
  Schema.annotations({
    title: 'DNA Hash',
    description: 'A Holochain DNA hash'
  })
);

export const AnyHashSchema = Schema.Union(AgentPubKeySchema, ActionHashSchema, EntryHashSchema);

export const TimestampSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand('Timestamp'),
  Schema.annotations({
    title: 'Timestamp',
    description: 'A Unix timestamp in microseconds'
  })
);

// Raw Uint8Array Schemas for Hashes
export const ActionHashRawSchema = Schema.instanceOf(
  Uint8Array
) as Schema.Schema<HolochainActionHash>;
export const EntryHashRawSchema = Schema.instanceOf(
  Uint8Array
) as Schema.Schema<HolochainEntryHash>;
export const AgentPubKeyRawSchema = Schema.instanceOf(
  Uint8Array
) as Schema.Schema<HolochainAgentPubKey>;

// Holochain Record schema
export const RecordSchema = Schema.Struct({
  signed_action: Schema.Struct({
    hashed: Schema.Struct({
      hash: ActionHashSchema,
      content: Schema.Struct({
        author: AgentPubKeySchema,
        timestamp: TimestampSchema,
        prev_action: ActionHashSchema.pipe(Schema.optional),
        action_seq: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
        entry_type: Schema.optional(Schema.String),
        entry_hash: Schema.optional(EntryHashSchema)
      })
    }),
    signature: Schema.String
  }),
  entry: Schema.Any
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
  target: AnyHashSchema,
  zome_index: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  link_type: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  tag: Schema.Any,
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
export type AnyHash = Schema.Schema.Type<typeof AnyHashSchema>;
export type Timestamp = Schema.Schema.Type<typeof TimestampSchema>;
export type HolochainRecord = Schema.Schema.Type<typeof RecordSchema>;
export type HolochainLink = Schema.Schema.Type<typeof LinkSchema>;

export const HoloHashB64Schema = Schema.String.pipe(
  Schema.brand('HoloHashB64'),
  Schema.annotations({
    title: 'HoloHash B64',
    description: 'A Holochain hash encoded in Base64'
  })
);
