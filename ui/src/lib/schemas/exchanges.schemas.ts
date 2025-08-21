import { Schema } from 'effect';
import { ActionHashSchema, RecordSchema, TimestampSchema } from './holochain.schemas';

// --- Enums ---

export const ExchangeResponseStatusSchema = Schema.Literal('Pending', 'Approved', 'Rejected');
export type ExchangeResponseStatus = Schema.Schema.Type<typeof ExchangeResponseStatusSchema>;

// Note: ExchangeResponseType removed in simplified version - all responses are now single type

export const AgreementStatusSchema = Schema.Literal('Active', 'Completed');
export type AgreementStatus = Schema.Schema.Type<typeof AgreementStatusSchema>;

export const ReviewerTypeSchema = Schema.Literal('Provider', 'Receiver');
export type ReviewerType = Schema.Schema.Type<typeof ReviewerTypeSchema>;

export const ValidatorRoleSchema = Schema.Literal('Provider', 'Receiver');
export type ValidatorRole = Schema.Schema.Type<typeof ValidatorRoleSchema>;

// --- Core Entities ---

export const ExchangeResponseSchema = Schema.Struct({
  service_details: Schema.String,
  terms: Schema.String,
  exchange_medium: Schema.String,
  exchange_value: Schema.NullishOr(Schema.String),
  delivery_timeframe: Schema.NullishOr(Schema.String),
  notes: Schema.NullishOr(Schema.String),
  status: ExchangeResponseStatusSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});
export type ExchangeResponse = Schema.Schema.Type<typeof ExchangeResponseSchema>;

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

export const CreateExchangeResponseInputSchema = Schema.Struct({
  target_entity_hash: ActionHashSchema,
  service_details: Schema.String,
  terms: Schema.String,
  exchange_medium: Schema.String,
  exchange_value: Schema.NullishOr(Schema.String),
  delivery_timeframe: Schema.NullishOr(Schema.String),
  notes: Schema.NullishOr(Schema.String)
});
export type CreateExchangeResponseInput = Schema.Schema.Type<
  typeof CreateExchangeResponseInputSchema
>;

export const UpdateExchangeResponseStatusInputSchema = Schema.Struct({
  response_hash: ActionHashSchema,
  new_status: ExchangeResponseStatusSchema,
  reason: Schema.NullishOr(Schema.String)
});
export type UpdateExchangeResponseStatusInput = Schema.Schema.Type<typeof UpdateExchangeResponseStatusInputSchema>;

export const CreateAgreementInputSchema = Schema.Struct({
  response_hash: ActionHashSchema,
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

export const UIExchangeResponseSchema = Schema.Struct({
  actionHash: ActionHashSchema,
  entry: ExchangeResponseSchema,
  targetEntityHash: ActionHashSchema,
  proposerPubkey: Schema.String,
  targetEntityType: Schema.Literal('request', 'offer'),
  // Additional UI properties will be populated by store helpers
  isLoading: Schema.Boolean,
  lastUpdated: TimestampSchema
});
export type UIExchangeResponse = Schema.Schema.Type<typeof UIExchangeResponseSchema>;

export const UIAgreementSchema = Schema.Struct({
  actionHash: ActionHashSchema,
  entry: AgreementSchema,
  responseHash: ActionHashSchema,
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

export const ExchangeResponseRecordSchema = Schema.Struct({
  signed_action: Schema.Any,
  entry: ExchangeResponseSchema
});
export type ExchangeResponseRecord = Schema.Schema.Type<typeof ExchangeResponseRecordSchema>;

export const ExchangeResponseRecordOrNullSchema = Schema.NullishOr(ExchangeResponseRecordSchema);
export type ExchangeResponseRecordOrNull = Schema.Schema.Type<
  typeof ExchangeResponseRecordOrNullSchema
>;

export const ExchangeResponseRecordsArraySchema = Schema.Array(ExchangeResponseRecordSchema);
export type ExchangeResponseRecordsArray = Schema.Schema.Type<
  typeof ExchangeResponseRecordsArraySchema
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
  responses: Schema.Array(UIExchangeResponseSchema),
  agreements: Schema.Array(UIAgreementSchema),
  reviews: Schema.Array(UIExchangeReviewSchema)
});
export type ExchangesCollection = Schema.Schema.Type<typeof ExchangesCollectionSchema>;
