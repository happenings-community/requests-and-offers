import { Schema } from 'effect';
import type { ActionHash, Record as HolochainRecord } from '@holochain/client';

// Core Medium of Exchange types
export interface MediumOfExchangeInDHT {
  code: string;
  name: string;
  resource_spec_hrea_id?: string | null;
}

export interface UIMediumOfExchange {
  actionHash: ActionHash;
  original_action_hash?: ActionHash; // Required for CacheableEntity compatibility
  code: string;
  name: string;
  resourceSpecHreaId?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt?: Date;
}

// Schema definitions
export const MediumOfExchangeInDHTSchema = Schema.Struct({
  code: Schema.String,
  name: Schema.String,
  resource_spec_hrea_id: Schema.optional(Schema.Union(Schema.String, Schema.Null))
});

export const UIMediumOfExchangeSchema = Schema.Class<UIMediumOfExchange>('UIMediumOfExchange')({
  actionHash: Schema.Unknown, // ActionHash type
  original_action_hash: Schema.optional(Schema.Unknown), // ActionHash type
  code: Schema.String,
  name: Schema.String,
  resourceSpecHreaId: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
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
