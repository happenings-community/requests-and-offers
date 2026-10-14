import { Schema } from 'effect';
import type { ActionHash, Record as HolochainRecord } from '@holochain/client';

// Core Medium of Exchange types
export interface MediumOfExchangeInDHT {
  code: string;
  name: string;
  description?: string | null;
  resource_spec_hrea_id?: string | null;
  exchange_type: 'base' | 'currency';
}

export interface UIMediumOfExchange {
  original_action_hash: ActionHash;
  previous_action_hash: ActionHash;
  code: string;
  name: string;
  description?: string | null;
  resourceSpecHreaId?: string | null;
  exchange_type: 'base' | 'currency';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt?: Date;
  [key: string]: unknown; // Index signature for CacheableEntity compatibility
}

// Schema definitions
export const MediumOfExchangeInDHTSchema = Schema.Struct({
  code: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  resource_spec_hrea_id: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  exchange_type: Schema.Literal('base', 'currency')
});

export const UIMediumOfExchangeSchema = Schema.Class<UIMediumOfExchange>('UIMediumOfExchange')({
  original_action_hash: Schema.Unknown, // ActionHash type
  previous_action_hash: Schema.Unknown, // ActionHash type
  code: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  resourceSpecHreaId: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  exchange_type: Schema.Literal('base', 'currency'),
  status: Schema.Literal('pending', 'approved', 'rejected'),
  createdAt: Schema.Date,
  updatedAt: Schema.optional(Schema.Date)
});

// Response schemas
export const MediumOfExchangeRecordSchema = Schema.Unknown; // HolochainRecord type
export const MediumOfExchangeRecordOrNullSchema = Schema.Union(
  MediumOfExchangeRecordSchema,
  Schema.Null
);
export const MediumOfExchangeRecordsArraySchema = Schema.Array(MediumOfExchangeRecordSchema);
export const VoidResponseSchema = Schema.Void;

// Collection type for organized mediums of exchange
export interface MediumsOfExchangeCollection {
  pending: HolochainRecord[];
  approved: HolochainRecord[];
  rejected: HolochainRecord[];
}

export const MediumsOfExchangeCollectionSchema = Schema.Struct({
  pending: MediumOfExchangeRecordsArraySchema,
  approved: MediumOfExchangeRecordsArraySchema,
  rejected: MediumOfExchangeRecordsArraySchema
});

// Input types for zome functions
export interface MediumOfExchangeInput {
  medium_of_exchange: MediumOfExchangeInDHT;
}

export const MediumOfExchangeInputSchema = Schema.Struct({
  medium_of_exchange: MediumOfExchangeInDHTSchema
});

// Export types for external use - using type aliases to avoid conflicts
export type MediumOfExchangeRecordType = typeof MediumOfExchangeRecordSchema;
export type MediumOfExchangeRecordOrNullType = typeof MediumOfExchangeRecordOrNullSchema;
export type MediumOfExchangeRecordsArrayType = typeof MediumOfExchangeRecordsArraySchema;
export type VoidResponseType = typeof VoidResponseSchema;
