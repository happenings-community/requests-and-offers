import { Schema } from 'effect';
import { decimalProblem, isZeroDecimal } from '../utils/decimal';

/**
 * Common schemas shared across multiple domains
 */

// Core TimePreference schema matching TimePreference from Holochain
export const TimePreferenceSchema = Schema.Union(
  Schema.Literal('Morning'),
  Schema.Literal('Afternoon'),
  Schema.Literal('Evening'),
  Schema.Literal('NoPreference'),
  Schema.Struct({
    Other: Schema.String
  })
).pipe(
  Schema.annotations({
    title: 'Time Preference',
    description: 'Preferred time for interaction'
  })
);

// Core InteractionType schema
export const InteractionTypeSchema = Schema.Union(
  Schema.Literal('Virtual'),
  Schema.Literal('InPerson')
).pipe(
  Schema.annotations({
    title: 'Interaction Type',
    description: 'Type of interaction (Virtual or InPerson)'
  })
);

// Core ContactPreference schema
export const ContactPreferenceSchema = Schema.Union(
  Schema.Literal('Email'),
  Schema.Literal('Phone'),
  Schema.Struct({ Other: Schema.String })
).pipe(
  Schema.annotations({
    title: 'Contact Preference',
    description: 'Preferred method of contact'
  })
);

/** A timeframe preset (#380), as the zome's `TimeframePreset` serialises. */
export const TimeframePresetSchema = Schema.Literal(
  'WithinAFewDays',
  'WithinTwoWeeks',
  'WithinAMonth',
  'Flexible'
);

/**
 * A timeframe (#380): a preset, or a window of dates (Holochain timestamps, in
 * microseconds) whose `end` is its due date. Matches the zome's externally tagged
 * `Timeframe`. The rules that need the writing action's timestamp (the window ends
 * after it, within 365 days) are the zome's: `timeframe_problem` in `utils`.
 */
export const TimeframeSchema = Schema.Union(
  Schema.Struct({ Preset: TimeframePresetSchema }),
  Schema.Struct({
    Dates: Schema.Struct({
      start: Schema.NullOr(Schema.Number.pipe(Schema.int())),
      end: Schema.Number.pipe(Schema.int())
    }).pipe(
      Schema.filter((d) => d.start === null || d.start <= d.end, {
        message: () => 'a timeframe must not start after it ends'
      })
    )
  })
).pipe(
  Schema.annotations({
    title: 'Timeframe',
    description: 'When: a preset, or a window of dates'
  })
);

/**
 * A listing's time estimate (#380, #525): an exact decimal string, zero allowed. An
 * estimate describes the task and is never exchanged, so it carries no unit and is
 * not a quantity. Matches `time_estimate_problem` in `utils::listing_rules`.
 */
export const TimeEstimateSchema = Schema.String.pipe(
  Schema.filter((v) => {
    const problem = decimalProblem(v);
    return problem === null || `a time estimate is not a decimal: ${problem}`;
  }),
  Schema.annotations({
    title: 'Estimated time (hours)',
    description: 'Roughly how long the task takes, in hours; zero is allowed'
  })
);

/**
 * A listing's amount (#380): what it asks or offers in payment, above zero, in a unit
 * (a currency, or a time-bank medium). Matches `amount_problem` in
 * `utils::listing_rules`, which is the exchange quantity's own rule.
 */
export const ListingAmountSchema = Schema.Struct({
  value: Schema.String.pipe(
    Schema.filter((v) => decimalProblem(v) === null || `an amount ${decimalProblem(v)}`),
    Schema.filter((v) => !isZeroDecimal(v) || 'an amount must be above zero, with a unit')
  ),
  unit: Schema.String.pipe(
    Schema.minLength(1, { message: () => 'an amount must be above zero, with a unit' })
  )
});

/** The three figures a request or an offer carries (#380). Each is optional. */
export const ListingFiguresFields = {
  timeframe: Schema.optional(Schema.NullOr(TimeframeSchema)),
  time_estimate_hours: Schema.optional(Schema.NullOr(TimeEstimateSchema)),
  amount: Schema.optional(Schema.NullOr(ListingAmountSchema))
};
