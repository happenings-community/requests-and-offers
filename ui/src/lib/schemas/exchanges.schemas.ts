import { Schema } from 'effect';
import { ActionHashSchema, RecordSchema, TimestampSchema } from './holochain.schemas';

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const ProposalStatusSchema = Schema.Literal(
  'Pending',
  'Approved', 
  'Rejected'
);

export const ProposalTypeSchema = Schema.Literal(
  'DirectResponse',
  'CrossLink'
);

export const AgreementStatusSchema = Schema.Literal(
  'Active',
  'Completed'
);

// Removed ExchangeEventTypeSchema and EventPrioritySchema - not needed in simplified plan

// Simplified review system - keeping only basic reviewer type
export const ReviewerTypeSchema = Schema.Literal(
  'Provider',
  'Receiver'
);

// Removed cancellation schemas - not needed in simplified plan
// Keeping basic ValidatorRoleSchema for completion marking
export const ValidatorRoleSchema = Schema.Literal(
  'Provider',
  'Receiver'
);

// ============================================================================
// ENTITY SCHEMAS
// ============================================================================

// Simplified ExchangeProposal for basic workflow
export const ExchangeProposalSchema = Schema.Struct({
  proposal_type: ProposalTypeSchema,
  service_details: Schema.String,
  terms: Schema.String,
  exchange_medium: Schema.String,
  exchange_value: Schema.optional(Schema.String),
  delivery_timeframe: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
  status: ProposalStatusSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});

// Simplified PublicReview for basic feedback
export const PublicReviewSchema = Schema.Struct({
  completed_on_time: Schema.Boolean,
  completed_as_agreed: Schema.Boolean,
  rating: Schema.Number.pipe(Schema.between(1, 5)),
  comments: Schema.optional(Schema.String.pipe(Schema.maxLength(200))),
  reviewer_type: ReviewerTypeSchema,
  reviewed_at: TimestampSchema
});

// Simplified ExchangeReview - essential feedback only
export const ExchangeReviewSchema = Schema.Struct({
  public_review: PublicReviewSchema,
  created_at: TimestampSchema
});

// Simplified Agreement for basic workflow
export const AgreementSchema = Schema.Struct({
  service_details: Schema.String,
  agreed_terms: Schema.String,
  exchange_medium: Schema.String,
  exchange_value: Schema.optional(Schema.String),
  delivery_timeframe: Schema.optional(Schema.String),
  status: AgreementStatusSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  provider_completed: Schema.Boolean,
  receiver_completed: Schema.Boolean,
  provider_completed_at: Schema.optional(TimestampSchema),
  receiver_completed_at: Schema.optional(TimestampSchema)
});

// Removed ExchangeEventSchema and ExchangeCancellationSchema - not needed in simplified plan

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

// Simplified input for creating exchange proposals
export const CreateExchangeProposalInputSchema = Schema.Struct({
  proposal_type: ProposalTypeSchema,
  target_entity_hash: ActionHashSchema,
  responder_entity_hash: Schema.optional(ActionHashSchema),
  service_details: Schema.String,
  terms: Schema.String,
  exchange_medium: Schema.String,
  exchange_value: Schema.optional(Schema.String),
  delivery_timeframe: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String)
});

export const UpdateProposalStatusInputSchema = Schema.Struct({
  proposal_hash: ActionHashSchema,
  new_status: ProposalStatusSchema,
  reason: Schema.optional(Schema.String)
});

// Simplified input for creating agreements (when proposal is approved)
export const CreateAgreementInputSchema = Schema.Struct({
  proposal_hash: ActionHashSchema,
  service_details: Schema.String,
  agreed_terms: Schema.String,
  exchange_medium: Schema.String,
  exchange_value: Schema.optional(Schema.String),
  delivery_timeframe: Schema.optional(Schema.String)
});

export const UpdateAgreementStatusInputSchema = Schema.Struct({
  agreement_hash: ActionHashSchema,
  new_status: AgreementStatusSchema
});

// Simplified input for marking completion
export const MarkCompleteInputSchema = Schema.Struct({
  agreement_hash: ActionHashSchema,
  validator_role: ValidatorRoleSchema
});

// Removed complex event and validation input schemas - not needed in simplified plan

// Simplified input for submitting reviews
export const CreateReviewInputSchema = Schema.Struct({
  agreement_hash: ActionHashSchema,
  completed_on_time: Schema.Boolean,
  completed_as_agreed: Schema.Boolean,
  rating: Schema.Number.pipe(Schema.between(1, 5)),
  comments: Schema.optional(Schema.String.pipe(Schema.maxLength(200))),
  reviewer_type: ReviewerTypeSchema
});

// Removed all cancellation input schemas - not needed in simplified plan

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const ExchangeRecordSchema = RecordSchema;
export const ExchangeRecordOrNullSchema = Schema.Union(RecordSchema, Schema.Null);
export const ExchangeRecordsArraySchema = Schema.Array(RecordSchema);
export const VoidResponseSchema = Schema.Void;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Simplified enum types
export type ProposalStatus = Schema.Schema.Type<typeof ProposalStatusSchema>;
export type ProposalType = Schema.Schema.Type<typeof ProposalTypeSchema>;
export type AgreementStatus = Schema.Schema.Type<typeof AgreementStatusSchema>;
export type ReviewerType = Schema.Schema.Type<typeof ReviewerTypeSchema>;
export type ValidatorRole = Schema.Schema.Type<typeof ValidatorRoleSchema>;

// Simplified entity types
export type ExchangeProposal = Schema.Schema.Type<typeof ExchangeProposalSchema>;
export type PublicReview = Schema.Schema.Type<typeof PublicReviewSchema>;
export type ExchangeReview = Schema.Schema.Type<typeof ExchangeReviewSchema>;
export type Agreement = Schema.Schema.Type<typeof AgreementSchema>;

// Simplified input types
export type CreateExchangeProposalInput = Schema.Schema.Type<typeof CreateExchangeProposalInputSchema>;
export type UpdateProposalStatusInput = Schema.Schema.Type<typeof UpdateProposalStatusInputSchema>;
export type CreateAgreementInput = Schema.Schema.Type<typeof CreateAgreementInputSchema>;
export type UpdateAgreementStatusInput = Schema.Schema.Type<typeof UpdateAgreementStatusInputSchema>;
export type MarkCompleteInput = Schema.Schema.Type<typeof MarkCompleteInputSchema>;
export type CreateReviewInput = Schema.Schema.Type<typeof CreateReviewInputSchema>;

// Responses
export type ExchangeRecordSchema = Schema.Schema.Type<typeof ExchangeRecordSchema>;
export type ExchangeRecordOrNullSchema = Schema.Schema.Type<typeof ExchangeRecordOrNullSchema>;
export type ExchangeRecordsArraySchema = Schema.Schema.Type<typeof ExchangeRecordsArraySchema>;
export type VoidResponseSchema = Schema.Schema.Type<typeof VoidResponseSchema>;