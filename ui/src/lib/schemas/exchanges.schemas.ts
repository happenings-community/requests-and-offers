import { Schema } from 'effect';
import { ActionHashSchema, RecordSchema, TimestampSchema } from './holochain.schemas';

// --- Enums ---

export const ProposalStatusSchema = Schema.Literal('Pending', 'Approved', 'Rejected');
export type ProposalStatus = Schema.Schema.Type<typeof ProposalStatusSchema>;

// Note: ProposalType removed in simplified version - all proposals are now single type

export const AgreementStatusSchema = Schema.Literal('Active', 'Completed');
export type AgreementStatus = Schema.Schema.Type<typeof AgreementStatusSchema>;

export const ReviewerTypeSchema = Schema.Literal('Provider', 'Receiver');
export type ReviewerType = Schema.Schema.Type<typeof ReviewerTypeSchema>;

export const ValidatorRoleSchema = Schema.Literal('Provider', 'Receiver');
export type ValidatorRole = Schema.Schema.Type<typeof ValidatorRoleSchema>;

// --- Core Entities ---

export const ExchangeProposalSchema = Schema.Struct({
  service_details: Schema.String,
  terms: Schema.String,
  exchange_medium: Schema.String,
  exchange_value: Schema.NullishOr(Schema.String),
  delivery_timeframe: Schema.NullishOr(Schema.String),
  notes: Schema.NullishOr(Schema.String),
  status: ProposalStatusSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});
export type ExchangeProposal = Schema.Schema.Type<typeof ExchangeProposalSchema>;

export const AgreementSchema = Schema.Struct({
  service_details: Schema.String,
  exchange_medium: Schema.String,
  exchange_value: Schema.NullishOr(Schema.String),
  delivery_timeframe: Schema.NullishOr(Schema.String),
  status: AgreementStatusSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  provider_completed: Schema.Boolean,
  receiver_completed: Schema.Boolean,
  provider_completed_at: Schema.NullishOr(TimestampSchema),
  receiver_completed_at: Schema.NullishOr(TimestampSchema)
});
export type Agreement = Schema.Schema.Type<typeof AgreementSchema>;

export const ExchangeReviewSchema = Schema.Struct({
  rating: Schema.Number,
  comments: Schema.NullishOr(Schema.String),
  reviewer_type: ReviewerTypeSchema,
  created_at: TimestampSchema
});
export type ExchangeReview = Schema.Schema.Type<typeof ExchangeReviewSchema>;

// --- Input Schemas ---

export const CreateExchangeProposalInputSchema = Schema.Struct({
  target_entity_hash: ActionHashSchema,
  service_details: Schema.String,
  terms: Schema.String,
  exchange_medium: Schema.String,
  exchange_value: Schema.NullishOr(Schema.String),
  delivery_timeframe: Schema.NullishOr(Schema.String),
  notes: Schema.NullishOr(Schema.String)
});
export type CreateExchangeProposalInput = Schema.Schema.Type<
  typeof CreateExchangeProposalInputSchema
>;

export const UpdateProposalStatusInputSchema = Schema.Struct({
  proposal_hash: ActionHashSchema,
  new_status: ProposalStatusSchema,
  reason: Schema.NullishOr(Schema.String)
});
export type UpdateProposalStatusInput = Schema.Schema.Type<typeof UpdateProposalStatusInputSchema>;

export const CreateAgreementInputSchema = Schema.Struct({
  proposal_hash: ActionHashSchema,
  service_details: Schema.String,
  exchange_medium: Schema.String,
  exchange_value: Schema.NullishOr(Schema.String),
  delivery_timeframe: Schema.NullishOr(Schema.String)
});
export type CreateAgreementInput = Schema.Schema.Type<typeof CreateAgreementInputSchema>;

export const UpdateAgreementStatusInputSchema = Schema.Struct({
  agreement_hash: ActionHashSchema,
  new_status: AgreementStatusSchema
});
export type UpdateAgreementStatusInput = Schema.Schema.Type<
  typeof UpdateAgreementStatusInputSchema
>;

export const MarkCompleteInputSchema = Schema.Struct({
  agreement_hash: ActionHashSchema,
  validator_role: ValidatorRoleSchema
});
export type MarkCompleteInput = Schema.Schema.Type<typeof MarkCompleteInputSchema>;

export const CreateReviewInputSchema = Schema.Struct({
  agreement_hash: ActionHashSchema,
  rating: Schema.Number,
  comments: Schema.NullishOr(Schema.String),
  reviewer_type: ReviewerTypeSchema
});
export type CreateReviewInput = Schema.Schema.Type<typeof CreateReviewInputSchema>;

// --- UI Types ---

export const UIExchangeProposalSchema = Schema.Struct({
  actionHash: ActionHashSchema,
  entry: ExchangeProposalSchema,
  targetEntityHash: ActionHashSchema,
  proposerPubkey: Schema.String,
  targetEntityType: Schema.Literal('request', 'offer'),
  // Additional UI properties will be populated by store helpers
  isLoading: Schema.Boolean,
  lastUpdated: TimestampSchema
});
export type UIExchangeProposal = Schema.Schema.Type<typeof UIExchangeProposalSchema>;

export const UIAgreementSchema = Schema.Struct({
  actionHash: ActionHashSchema,
  entry: AgreementSchema,
  proposalHash: ActionHashSchema,
  targetEntityHash: ActionHashSchema,
  providerPubkey: Schema.String,
  receiverPubkey: Schema.String,
  // Additional UI properties
  isLoading: Schema.Boolean,
  lastUpdated: TimestampSchema,
  canMarkComplete: Schema.Boolean,
  awaitingCompletion: Schema.Boolean
});
export type UIAgreement = Schema.Schema.Type<typeof UIAgreementSchema>;

export const UIExchangeReviewSchema = Schema.Struct({
  actionHash: ActionHashSchema,
  entry: ExchangeReviewSchema,
  agreementHash: ActionHashSchema,
  reviewerPubkey: Schema.String,
  // Additional UI properties
  isLoading: Schema.Boolean,
  lastUpdated: TimestampSchema
});
export type UIExchangeReview = Schema.Schema.Type<typeof UIExchangeReviewSchema>;

export const ReviewStatisticsSchema = Schema.Struct({
  total_reviews: Schema.Number,
  average_rating: Schema.Number,
  total_completed_exchanges: Schema.Number
});
export type ReviewStatistics = Schema.Schema.Type<typeof ReviewStatisticsSchema>;

// --- Collection Schemas ---

export const ExchangeProposalRecordSchema = Schema.Struct({
  signed_action: Schema.Any,
  entry: ExchangeProposalSchema
});
export type ExchangeProposalRecord = Schema.Schema.Type<typeof ExchangeProposalRecordSchema>;

export const ExchangeProposalRecordOrNullSchema = Schema.NullishOr(ExchangeProposalRecordSchema);
export type ExchangeProposalRecordOrNull = Schema.Schema.Type<
  typeof ExchangeProposalRecordOrNullSchema
>;

export const ExchangeProposalRecordsArraySchema = Schema.Array(ExchangeProposalRecordSchema);
export type ExchangeProposalRecordsArray = Schema.Schema.Type<
  typeof ExchangeProposalRecordsArraySchema
>;

export const AgreementRecordSchema = Schema.Struct({
  signed_action: Schema.Any,
  entry: AgreementSchema
});
export type AgreementRecord = Schema.Schema.Type<typeof AgreementRecordSchema>;

export const AgreementRecordOrNullSchema = Schema.NullishOr(AgreementRecordSchema);
export type AgreementRecordOrNull = Schema.Schema.Type<typeof AgreementRecordOrNullSchema>;

export const AgreementRecordsArraySchema = Schema.Array(AgreementRecordSchema);
export type AgreementRecordsArray = Schema.Schema.Type<typeof AgreementRecordsArraySchema>;

export const ExchangeReviewRecordSchema = Schema.Struct({
  signed_action: Schema.Any,
  entry: ExchangeReviewSchema
});
export type ExchangeReviewRecord = Schema.Schema.Type<typeof ExchangeReviewRecordSchema>;

export const ExchangeReviewRecordOrNullSchema = Schema.NullishOr(ExchangeReviewRecordSchema);
export type ExchangeReviewRecordOrNull = Schema.Schema.Type<
  typeof ExchangeReviewRecordOrNullSchema
>;

export const ExchangeReviewRecordsArraySchema = Schema.Array(ExchangeReviewRecordSchema);
export type ExchangeReviewRecordsArray = Schema.Schema.Type<
  typeof ExchangeReviewRecordsArraySchema
>;

// --- Response Schemas ---

export const VoidResponseSchema = Schema.Void;
export type VoidResponse = Schema.Schema.Type<typeof VoidResponseSchema>;

// --- Collections ---

export const ExchangesCollectionSchema = Schema.Struct({
  proposals: Schema.Array(UIExchangeProposalSchema),
  agreements: Schema.Array(UIAgreementSchema),
  reviews: Schema.Array(UIExchangeReviewSchema)
});
export type ExchangesCollection = Schema.Schema.Type<typeof ExchangesCollectionSchema>;
