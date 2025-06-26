import type { ActionHash, AgentPubKey } from '@holochain/client';
import { encodeHashToBase64, decodeHashFromBase64 } from '@holochain/client';
import { Schema } from 'effect';
import { ActionHashSchema, AgentPubKeySchema } from '$lib/schemas/holochain.schemas';

/**
 * Bridge utilities for converting between legacy UI types and new schema types
 * This allows gradual migration while maintaining compatibility
 */

/**
 * Convert HoloHash (Uint8Array) to branded string ActionHash for schema compatibility
 */
export function actionHashToString(hash: ActionHash): Schema.Schema.Type<typeof ActionHashSchema> {
  // Convert Uint8Array to base64 string and return as branded string
  return encodeHashToBase64(hash) as Schema.Schema.Type<typeof ActionHashSchema>;
}

/**
 * Convert branded string ActionHash back to HoloHash (Uint8Array)
 */
export function stringToActionHash(
  hashString: Schema.Schema.Type<typeof ActionHashSchema>
): ActionHash {
  // Convert base64 string back to Uint8Array
  return decodeHashFromBase64(hashString as string);
}

/**
 * Convert HoloHash (Uint8Array) to branded string AgentPubKey for schema compatibility
 */
export function agentPubKeyToString(
  pubKey: AgentPubKey
): Schema.Schema.Type<typeof AgentPubKeySchema> {
  return encodeHashToBase64(pubKey) as Schema.Schema.Type<typeof AgentPubKeySchema>;
}

/**
 * Convert branded string AgentPubKey back to HoloHash (Uint8Array)
 */
export function stringToAgentPubKey(
  pubKeyString: Schema.Schema.Type<typeof AgentPubKeySchema>
): AgentPubKey {
  return decodeHashFromBase64(pubKeyString as string);
}

/**
 * Helper to create GetServiceTypeForEntityInput with proper type conversion
 */
export function createGetServiceTypeForEntityInput(
  original_action_hash: ActionHash,
  entity: 'request' | 'offer' | 'user'
): {
  original_action_hash: Schema.Schema.Type<typeof ActionHashSchema>;
  entity: 'request' | 'offer' | 'user';
} {
  return {
    original_action_hash: actionHashToString(original_action_hash),
    entity
  };
}
