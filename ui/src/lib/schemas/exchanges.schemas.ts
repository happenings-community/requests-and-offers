import { Schema } from 'effect';
import { ActionHashSchema, RecordSchema, TimestampSchema } from './holochain.schemas';

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const ProposalStatusSchema = Schema.Literal(
  'Pending',
  'Accepted', 
  'Rejected',
  'Expired'
);

export const ProposalTypeSchema = Schema.Literal(
  'DirectResponse',
  'CrossLink'
);

export const AgreementStatusSchema = Schema.Literal(
  'Active',
  'InProgress',
  'Completed',
  'CancelledMutual',
  'CancelledProvider',
  'CancelledReceiver',
  'Failed',
  'Disputed'
);

export const ExchangeEventTypeSchema = Schema.Union(
  Schema.Literal('AgreementStarted'),
  Schema.Literal('ProgressUpdate'),
  Schema.Literal('MilestoneReached'),
  Schema.Literal('IssueReported'),
  Schema.Literal('DeliveryCompleted'),
  Schema.Literal('PaymentProcessed'),
  Schema.Struct({ Other: Schema.String })
);

export const EventPrioritySchema = Schema.Literal(
  'Low',
  'Normal',
  'High',
  'Critical'
);

export const ReviewerTypeSchema = Schema.Literal(
  'Provider',
  'Receiver'
);

export const CancellationReasonSchema = Schema.Union(
  Schema.Literal('MutualAgreement'),
  Schema.Literal('ProviderUnavailable'),
  Schema.Literal('ReceiverNoLongerNeeds'),
  Schema.Literal('ExternalCircumstances'),
  Schema.Literal('TechnicalFailure'),
  Schema.Struct({ Other: Schema.String })
);

export const CancellationInitiatorSchema = Schema.Literal(
  'Provider',
  'Receiver',
  'Both',
  'System'
);

export const ValidatorRoleSchema = Schema.Literal(
  'Provider',
  'Receiver'
);

// ============================================================================
// ENTITY SCHEMAS
// ============================================================================

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
  expires_at: Schema.optional(TimestampSchema),
  updated_at: TimestampSchema
});

export const PublicReviewSchema = Schema.Struct({
  completed_on_time: Schema.Boolean,
  completed_as_agreed: Schema.Boolean,
  rating: Schema.Number.pipe(Schema.between(0, 5)),
  comments: Schema.optional(Schema.String),
  reviewer_type: ReviewerTypeSchema,
  reviewed_at: TimestampSchema
});

export const ExchangeReviewSchema = Schema.Struct({
  provider_validation: Schema.Boolean,
  receiver_validation: Schema.Boolean,
  public_review: Schema.optional(PublicReviewSchema),
  created_at: TimestampSchema,
  is_public: Schema.Boolean
});

export const AgreementSchema = Schema.Struct({
  service_details: Schema.String,
  agreed_terms: Schema.String,
  exchange_medium: Schema.String,
  exchange_value: Schema.optional(Schema.String),
  delivery_timeframe: Schema.optional(Schema.String),
  additional_conditions: Schema.optional(Schema.String),
  status: AgreementStatusSchema,
  created_at: TimestampSchema,
  start_date: Schema.optional(TimestampSchema),
  completion_date: Schema.optional(TimestampSchema),
  updated_at: TimestampSchema,
  provider_validated: Schema.Boolean,
  receiver_validated: Schema.Boolean,
  provider_validated_at: Schema.optional(TimestampSchema),
  receiver_validated_at: Schema.optional(TimestampSchema)
});

export const ExchangeEventSchema = Schema.Struct({
  event_type: ExchangeEventTypeSchema,
  priority: EventPrioritySchema,
  title: Schema.String,
  description: Schema.String,
  progress_percentage: Schema.optional(Schema.Number.pipe(Schema.between(0, 100))),
  attachments: Schema.Array(Schema.String),
  occurred_at: TimestampSchema,
  recorded_at: TimestampSchema,
  is_public: Schema.Boolean,
  metadata: Schema.Record({ key: Schema.String, value: Schema.String })
});

export const ExchangeCancellationSchema = Schema.Struct({
  reason: CancellationReasonSchema,
  initiated_by: CancellationInitiatorSchema,
  other_party_consent: Schema.optional(Schema.Boolean),
  admin_reviewed: Schema.Boolean,
  initiated_at: TimestampSchema,
  response_at: Schema.optional(TimestampSchema),
  admin_reviewed_at: Schema.optional(TimestampSchema),
  explanation: Schema.String,
  other_party_notes: Schema.optional(Schema.String),
  admin_notes: Schema.optional(Schema.String),
  resolution_terms: Schema.optional(Schema.String)
});

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const CreateExchangeProposalInputSchema = Schema.Struct({
  proposal_type: ProposalTypeSchema,
  target_entity_hash: ActionHashSchema,
  responder_entity_hash: Schema.optional(ActionHashSchema),
  service_details: Schema.String,
  terms: Schema.String,
  exchange_medium: Schema.String,
  exchange_value: Schema.optional(Schema.String),
  delivery_timeframe: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
  expires_at: Schema.optional(TimestampSchema)
});

export const UpdateProposalStatusInputSchema = Schema.Struct({
  proposal_hash: ActionHashSchema,
  new_status: ProposalStatusSchema,
  reason: Schema.optional(Schema.String)
});

export const CreateAgreementInputSchema = Schema.Struct({
  proposal_hash: ActionHashSchema,
  service_details: Schema.String,
  agreed_terms: Schema.String,
  exchange_medium: Schema.String,
  exchange_value: Schema.optional(Schema.String),
  delivery_timeframe: Schema.optional(Schema.String),
  additional_conditions: Schema.optional(Schema.String),
  start_date: Schema.optional(TimestampSchema),
  completion_date: Schema.optional(TimestampSchema)
});

export const UpdateAgreementStatusInputSchema = Schema.Struct({
  agreement_hash: ActionHashSchema,
  new_status: AgreementStatusSchema
});

export const ValidateCompletionInputSchema = Schema.Struct({
  agreement_hash: ActionHashSchema,
  validator_role: ValidatorRoleSchema
});

export const CreateExchangeEventInputSchema = Schema.Struct({
  agreement_hash: ActionHashSchema,
  event_type: ExchangeEventTypeSchema,
  priority: EventPrioritySchema,
  title: Schema.String,
  description: Schema.String,
  progress_percentage: Schema.optional(Schema.Number.pipe(Schema.between(0, 100))),
  attachments: Schema.Array(Schema.String),
  occurred_at: Schema.optional(TimestampSchema),
  is_public: Schema.Boolean,
  metadata: Schema.Record({ key: Schema.String, value: Schema.String })
});

export const CreateMutualValidationInputSchema = Schema.Struct({
  agreement_hash: ActionHashSchema,
  provider_validation: Schema.Boolean,
  receiver_validation: Schema.Boolean
});

export const CreatePublicReviewInputSchema = Schema.Struct({
  agreement_hash: ActionHashSchema,
  provider_validation: Schema.Boolean,
  receiver_validation: Schema.Boolean,
  completed_on_time: Schema.Boolean,
  completed_as_agreed: Schema.Boolean,
  rating: Schema.Number.pipe(Schema.between(0, 5)),
  comments: Schema.optional(Schema.String),
  reviewer_type: ReviewerTypeSchema
});

export const CreateMutualCancellationInputSchema = Schema.Struct({
  agreement_hash: ActionHashSchema,
  reason: CancellationReasonSchema,
  explanation: Schema.String,
  resolution_terms: Schema.optional(Schema.String)
});

export const CreateUnilateralCancellationInputSchema = Schema.Struct({
  agreement_hash: ActionHashSchema,
  reason: CancellationReasonSchema,
  initiated_by: CancellationInitiatorSchema,
  explanation: Schema.String
});

export const RespondToCancellationInputSchema = Schema.Struct({
  cancellation_hash: ActionHashSchema,
  consent: Schema.Boolean,
  notes: Schema.optional(Schema.String)
});

export const AdminReviewCancellationInputSchema = Schema.Struct({
  cancellation_hash: ActionHashSchema,
  admin_notes: Schema.String,
  resolution_terms: Schema.optional(Schema.String)
});

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

// Enums
export type ProposalStatus = Schema.Schema.Type<typeof ProposalStatusSchema>;
export type ProposalType = Schema.Schema.Type<typeof ProposalTypeSchema>;
export type AgreementStatus = Schema.Schema.Type<typeof AgreementStatusSchema>;
export type ExchangeEventType = Schema.Schema.Type<typeof ExchangeEventTypeSchema>;
export type EventPriority = Schema.Schema.Type<typeof EventPrioritySchema>;
export type ReviewerType = Schema.Schema.Type<typeof ReviewerTypeSchema>;
export type CancellationReason = Schema.Schema.Type<typeof CancellationReasonSchema>;
export type CancellationInitiator = Schema.Schema.Type<typeof CancellationInitiatorSchema>;
export type ValidatorRole = Schema.Schema.Type<typeof ValidatorRoleSchema>;

// Entities
export type ExchangeProposal = Schema.Schema.Type<typeof ExchangeProposalSchema>;
export type PublicReview = Schema.Schema.Type<typeof PublicReviewSchema>;
export type ExchangeReview = Schema.Schema.Type<typeof ExchangeReviewSchema>;
export type Agreement = Schema.Schema.Type<typeof AgreementSchema>;
export type ExchangeEvent = Schema.Schema.Type<typeof ExchangeEventSchema>;
export type ExchangeCancellation = Schema.Schema.Type<typeof ExchangeCancellationSchema>;

// Inputs
export type CreateExchangeProposalInput = Schema.Schema.Type<typeof CreateExchangeProposalInputSchema>;
export type UpdateProposalStatusInput = Schema.Schema.Type<typeof UpdateProposalStatusInputSchema>;
export type CreateAgreementInput = Schema.Schema.Type<typeof CreateAgreementInputSchema>;
export type UpdateAgreementStatusInput = Schema.Schema.Type<typeof UpdateAgreementStatusInputSchema>;
export type ValidateCompletionInput = Schema.Schema.Type<typeof ValidateCompletionInputSchema>;
export type CreateExchangeEventInput = Schema.Schema.Type<typeof CreateExchangeEventInputSchema>;
export type CreateMutualValidationInput = Schema.Schema.Type<typeof CreateMutualValidationInputSchema>;
export type CreatePublicReviewInput = Schema.Schema.Type<typeof CreatePublicReviewInputSchema>;
export type CreateMutualCancellationInput = Schema.Schema.Type<typeof CreateMutualCancellationInputSchema>;
export type CreateUnilateralCancellationInput = Schema.Schema.Type<typeof CreateUnilateralCancellationInputSchema>;
export type RespondToCancellationInput = Schema.Schema.Type<typeof RespondToCancellationInputSchema>;
export type AdminReviewCancellationInput = Schema.Schema.Type<typeof AdminReviewCancellationInputSchema>;

// Responses
export type ExchangeRecordSchema = Schema.Schema.Type<typeof ExchangeRecordSchema>;
export type ExchangeRecordOrNullSchema = Schema.Schema.Type<typeof ExchangeRecordOrNullSchema>;
export type ExchangeRecordsArraySchema = Schema.Schema.Type<typeof ExchangeRecordsArraySchema>;
export type VoidResponseSchema = Schema.Schema.Type<typeof VoidResponseSchema>;