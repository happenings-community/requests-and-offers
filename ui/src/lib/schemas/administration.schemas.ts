import { Schema } from 'effect';
import { ActionHashSchema, AgentPubKeySchema, RecordSchema } from './holochain.schemas';
import { AdministrationEntity } from '$lib/types/holochain';

// ============================================================================
// BASIC SCHEMAS
// ============================================================================

export const AdministrationEntitySchema = Schema.Literal(
  AdministrationEntity.Network,
  AdministrationEntity.Users,
  AdministrationEntity.Organizations
);

export const StatusTypeSchema = Schema.Union(
  Schema.Literal('pending'),
  Schema.Literal('accepted'),
  Schema.Literal('rejected'),
  Schema.Literal('archived'),
  Schema.Literal('suspended temporarily'),
  Schema.Literal('suspended indefinitely')
);

export const StatusInDHTSchema = Schema.Struct({
  status_type: StatusTypeSchema,
  reason: Schema.optional(Schema.String),
  suspended_until: Schema.optional(Schema.String),
  created_at: Schema.optional(Schema.Number),
  updated_at: Schema.optional(Schema.Number)
});

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const RegisterAdministratorInputSchema = Schema.Struct({
  entity: AdministrationEntitySchema,
  entity_original_action_hash: ActionHashSchema,
  agent_pubkeys: Schema.Array(AgentPubKeySchema)
});

export const AddAdministratorInputSchema = Schema.Struct({
  entity: AdministrationEntitySchema,
  entity_original_action_hash: ActionHashSchema,
  agent_pubkeys: Schema.Array(AgentPubKeySchema)
});

export const RemoveAdministratorInputSchema = Schema.Struct({
  entity: AdministrationEntitySchema,
  entity_original_action_hash: ActionHashSchema,
  agent_pubkeys: Schema.Array(AgentPubKeySchema)
});

export const CheckAdministratorInputSchema = Schema.Struct({
  entity: AdministrationEntitySchema,
  agent_pubkey: AgentPubKeySchema
});

export const UpdateEntityStatusInputSchema = Schema.Struct({
  entity: AdministrationEntitySchema,
  entity_original_action_hash: ActionHashSchema,
  status_original_action_hash: ActionHashSchema,
  status_previous_action_hash: ActionHashSchema,
  new_status: StatusInDHTSchema
});

export const GetEntityStatusInputSchema = Schema.Struct({
  entity: AdministrationEntitySchema,
  entity_original_action_hash: ActionHashSchema
});

// ============================================================================
// DECODED TYPES
// ============================================================================

export interface StatusInDHTDecoded extends Schema.Schema.Type<typeof StatusInDHTSchema> {}
export interface RegisterAdministratorInputDecoded
  extends Schema.Schema.Type<typeof RegisterAdministratorInputSchema> {}
export interface AddAdministratorInputDecoded
  extends Schema.Schema.Type<typeof AddAdministratorInputSchema> {}
export interface RemoveAdministratorInputDecoded
  extends Schema.Schema.Type<typeof RemoveAdministratorInputSchema> {}
export interface CheckAdministratorInputDecoded
  extends Schema.Schema.Type<typeof CheckAdministratorInputSchema> {}
export interface UpdateEntityStatusInputDecoded
  extends Schema.Schema.Type<typeof UpdateEntityStatusInputSchema> {}
export interface GetEntityStatusInputDecoded
  extends Schema.Schema.Type<typeof GetEntityStatusInputSchema> {}

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const BooleanResponseSchema = Schema.Boolean;
export const LinkArraySchema = Schema.Array(Schema.Any); // Links don't have a specific schema yet
export const RecordArraySchema = Schema.Array(RecordSchema);
export const OptionalRecordSchema = Schema.Union(RecordSchema, Schema.Null);

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

export const validateStatusInDHT = Schema.decodeUnknown(StatusInDHTSchema);
export const validateRegisterAdministratorInput = Schema.decodeUnknown(
  RegisterAdministratorInputSchema
);
export const validateAddAdministratorInput = Schema.decodeUnknown(AddAdministratorInputSchema);
export const validateRemoveAdministratorInput = Schema.decodeUnknown(
  RemoveAdministratorInputSchema
);
export const validateCheckAdministratorInput = Schema.decodeUnknown(CheckAdministratorInputSchema);
export const validateUpdateEntityStatusInput = Schema.decodeUnknown(UpdateEntityStatusInputSchema);
export const validateGetEntityStatusInput = Schema.decodeUnknown(GetEntityStatusInputSchema);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  StatusInDHTDecoded as StatusInDHT,
  RegisterAdministratorInputDecoded as RegisterAdministratorInput,
  AddAdministratorInputDecoded as AddAdministratorInput,
  RemoveAdministratorInputDecoded as RemoveAdministratorInput,
  CheckAdministratorInputDecoded as CheckAdministratorInput,
  UpdateEntityStatusInputDecoded as UpdateEntityStatusInput,
  GetEntityStatusInputDecoded as GetEntityStatusInput
};
