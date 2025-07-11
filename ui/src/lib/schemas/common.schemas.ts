import { Schema } from 'effect';

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

// Core DateRange schema
export const DateRangeSchema = Schema.Struct({
  start: Schema.NullOr(Schema.Number),
  end: Schema.NullOr(Schema.Number)
}).pipe(
  Schema.annotations({
    title: 'Date Range',
    description: 'Date range for the request/offer'
  })
);
