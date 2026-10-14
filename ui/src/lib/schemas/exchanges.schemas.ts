import { Schema } from 'effect';
import { ActionHashSchema } from './holochain.schemas';

/**
 * Exchange schemas.
 *
 * These mirror the integrity zome in
 * `dnas/requests_and_offers/zomes/integrity/exchanges/src/lib.rs`, one rule for
 * one rule, so a proposal that the DHT would refuse is refused in the form
 * instead of on the round trip. Where a schema is stricter than the zome it
 * says so on the schema itself and the tests pin it, because this file is read
 * as the contract and a silent extra rule is the kind that gets debugged from
 * the wrong end. `ReviewInputSchema` is the one such case today: the zome
 * refuses a rating above five, the form also refuses one below one.
 *
 * Decoding is a gate and never a transform. `validated` discards the decoded
 * value, so the raw input is what reaches the zome; a schema that needed to
 * change its payload would not be honoured here.
 *
 * See `documentation/technical-specs/zomes/exchanges.md`.
 */

// ============================================================================
// PRIMITIVES
// ============================================================================

export const ListingTypeSchema = Schema.Literal('Request', 'Offer').annotations({
  title: 'Listing Type',
  description: 'Whether the exchange started from a request or from an offer'
});

export const ExchangeDirectionSchema = Schema.Literal('Provide', 'Receive').annotations({
  title: 'Exchange Direction',
  description: 'Which way a term flows, read from the provider'
});

export const ResourceKindSchema = Schema.Literal('Service', 'Currency', 'Gift', 'Tbd').annotations({
  title: 'Resource Kind',
  description: 'What kind of thing a term names'
});

/** `validate_term`: a quantity is positive, finite, and carries a unit. */
export class ExchangeQuantity extends Schema.Class<ExchangeQuantity>('ExchangeQuantity')({
  value: Schema.Number.pipe(
    Schema.finite({ message: () => 'Quantity must be a number' }),
    Schema.positive({ message: () => 'Quantity must be greater than zero' })
  ),
  unit: Schema.String.pipe(Schema.minLength(1, { message: () => 'Quantity needs a unit' }))
}) {}

// ============================================================================
// TERMS
// ============================================================================

const TermFields = {
  direction: ExchangeDirectionSchema,
  resource_conforms_to: Schema.String,
  resource_kind: ResourceKindSchema,
  quantity: Schema.NullOr(ExchangeQuantity)
};

type TermShape = {
  readonly direction: 'Provide' | 'Receive';
  readonly resource_conforms_to: string;
  readonly resource_kind: 'Service' | 'Currency' | 'Gift' | 'Tbd';
  readonly quantity: ExchangeQuantity | null;
};

/**
 * `validate_term`, the kind rule: a gift or an undecided term names nothing and
 * counts nothing; a service or a currency names the specification it conforms
 * to. The zome refuses the other combinations outright.
 */
const kindAgrees = (term: TermShape): true | string => {
  const bare = term.resource_kind === 'Gift' || term.resource_kind === 'Tbd';
  if (bare && term.quantity !== null) {
    return 'A gift or an undecided term carries no quantity';
  }
  if (bare && term.resource_conforms_to.length > 0) {
    return 'A gift or an undecided term names no resource';
  }
  if (!bare && term.resource_conforms_to.length === 0) {
    return 'This term names no resource specification';
  }
  return true;
};

export const ExchangeTermSchema = Schema.Struct(TermFields).pipe(
  Schema.filter((term) => {
    const verdict = kindAgrees(term);
    return verdict === true ? undefined : verdict;
  }),
  Schema.annotations({ title: 'Exchange Term' })
);

/** `validate_agreement`: the primary term is the service the provider provides. */
export const PrimaryTermSchema = ExchangeTermSchema.pipe(
  Schema.filter((term) =>
    term.direction === 'Provide' && term.resource_kind === 'Service'
      ? undefined
      : 'The primary term is the service provided'
  ),
  Schema.annotations({ title: 'Primary Term' })
);

/** `validate_agreement`: the reciprocal term is what the provider receives. */
export const ReciprocalTermSchema = ExchangeTermSchema.pipe(
  Schema.filter((term) =>
    term.direction === 'Receive' ? undefined : 'The reciprocal term is what the provider receives'
  ),
  Schema.annotations({ title: 'Reciprocal Term' })
);

// ============================================================================
// WRITE INPUTS
// ============================================================================

/** The payload of `create_agreement`. */
export class CreateAgreementInputSchema extends Schema.Class<CreateAgreementInputSchema>(
  'CreateAgreementInput'
)({
  listing: ActionHashSchema,
  listing_type: ListingTypeSchema,
  interest: ActionHashSchema,
  primary: PrimaryTermSchema,
  reciprocal: ReciprocalTermSchema,
  medium: Schema.String.pipe(
    Schema.filter((value) => value.trim().length > 0, {
      message: () => 'Choose how this exchange is settled'
    })
  ),
  terms: Schema.String,
  delivery_timeframe: Schema.String
}) {}

/** The payload of `respond_to_agreement`. */
export class RespondToAgreementInputSchema extends Schema.Class<RespondToAgreementInputSchema>(
  'RespondToAgreementInput'
)({
  agreement: ActionHashSchema,
  accepted: Schema.Boolean,
  note: Schema.String
}) {}

/**
 * The payload of `review_agreement`. `validate_review` refuses anything above
 * five; the form refuses anything below one, because a review is a rating.
 */
export class ReviewInputSchema extends Schema.Class<ReviewInputSchema>('ReviewInput')({
  rating: Schema.Number.pipe(
    Schema.int({ message: () => 'A rating is a whole number of stars' }),
    Schema.between(1, 5, { message: () => 'Rate this exchange from one to five stars' })
  ),
  on_time: Schema.Boolean,
  as_agreed: Schema.Boolean,
  comment: Schema.String
}) {}

/** The payload of `cancel_agreement`. */
export class CancelAgreementInputSchema extends Schema.Class<CancelAgreementInputSchema>(
  'CancelAgreementInput'
)({
  agreement: ActionHashSchema,
  note: Schema.String
}) {}

/** The payload of `create_interest`. */
export class CreateInterestInputSchema extends Schema.Class<CreateInterestInputSchema>(
  'CreateInterestInput'
)({
  listing: ActionHashSchema,
  listing_type: ListingTypeSchema
}) {}

// ============================================================================
// DECODING
// ============================================================================

export const decodeCreateAgreementInput = Schema.decodeUnknownEither(CreateAgreementInputSchema);
export const decodeRespondToAgreementInput = Schema.decodeUnknownEither(
  RespondToAgreementInputSchema
);
export const decodeReviewInput = Schema.decodeUnknownEither(ReviewInputSchema);
export const decodeCancelAgreementInput = Schema.decodeUnknownEither(CancelAgreementInputSchema);
export const decodeCreateInterestInput = Schema.decodeUnknownEither(CreateInterestInputSchema);
export const decodeExchangeTerm = Schema.decodeUnknownEither(ExchangeTermSchema);
