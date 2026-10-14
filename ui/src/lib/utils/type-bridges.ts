import { encodeHashToBase64, decodeHashFromBase64 } from '@holochain/client';
import type { ActionHash, AgentPubKey } from '@holochain/client';
import { Schema } from 'effect';
import { ActionHashSchema, AgentPubKeySchema } from '$lib/schemas/holochain.schemas';

/**
 * Type bridge utilities for converting between Holochain types and schema types
 * These functions handle the conversion between branded string types (from schemas)
 * and actual Holochain types (Uint8Array hashes)
 */

/**
 * Convert ActionHash (Uint8Array) to schema-compatible string format
 */
export function actionHashToSchemaType(
  hash: ActionHash
): Schema.Schema.Type<typeof ActionHashSchema> {
  // Convert Uint8Array to base64 string and return as branded string
  return encodeHashToBase64(hash) as unknown as Schema.Schema.Type<typeof ActionHashSchema>;
}

/**
 * Convert schema string format back to ActionHash (Uint8Array)
 */
export function schemaTypeToActionHash(
  hashString: Schema.Schema.Type<typeof ActionHashSchema>
): ActionHash {
  // Convert base64 string back to Uint8Array
  return decodeHashFromBase64(hashString as unknown as string);
}

/**
 * Convert AgentPubKey (Uint8Array) to schema-compatible string format
 */
export function agentPubKeyToSchemaType(
  pubKey: AgentPubKey
): Schema.Schema.Type<typeof AgentPubKeySchema> {
  return encodeHashToBase64(pubKey) as unknown as Schema.Schema.Type<typeof AgentPubKeySchema>;
}

/**
 * Convert schema string format back to AgentPubKey (Uint8Array)
 */
export function schemaTypeToAgentPubKey(
  pubKeyString: Schema.Schema.Type<typeof AgentPubKeySchema>
): AgentPubKey {
  return decodeHashFromBase64(pubKeyString as unknown as string);
}
