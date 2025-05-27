import { Schema } from 'effect';

// UI State schemas
export const LoadingStateSchema = Schema.Literal('idle', 'loading', 'success', 'error').pipe(
  Schema.annotations({
    title: 'Loading State',
    description: 'The current loading state of an async operation'
  })
);

export const NotificationTypeSchema = Schema.Literal('info', 'success', 'warning', 'error').pipe(
  Schema.annotations({
    title: 'Notification Type',
    description: 'The type/severity of a notification'
  })
);

export const NotificationSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.nonEmptyString()),
  type: NotificationTypeSchema,
  title: Schema.String.pipe(Schema.nonEmptyString()),
  message: Schema.String,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
  duration: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  actions: Schema.optional(
    Schema.Array(
      Schema.Struct({
        label: Schema.String.pipe(Schema.nonEmptyString()),
        action: Schema.String.pipe(Schema.nonEmptyString())
      })
    )
  )
}).pipe(
  Schema.annotations({
    title: 'Notification',
    description: 'A user notification with optional actions'
  })
);

// Pagination schemas
export const PaginationSchema = Schema.Struct({
  page: Schema.Number.pipe(Schema.int(), Schema.positive()),
  limit: Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.lessThanOrEqualTo(100)),
  total: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  hasNext: Schema.Boolean,
  hasPrev: Schema.Boolean
}).pipe(
  Schema.annotations({
    title: 'Pagination',
    description: 'Pagination information for lists'
  })
);

// Filter and sort schemas
export const SortDirectionSchema = Schema.Literal('asc', 'desc').pipe(
  Schema.annotations({
    title: 'Sort Direction',
    description: 'The direction to sort results'
  })
);

export const SortSchema = Schema.Struct({
  field: Schema.String.pipe(Schema.nonEmptyString()),
  direction: SortDirectionSchema
}).pipe(
  Schema.annotations({
    title: 'Sort Configuration',
    description: 'How to sort a list of items'
  })
);

// Search schemas
export const SearchFiltersSchema = Schema.Struct({
  query: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String.pipe(Schema.nonEmptyString()))),
  dateRange: Schema.optional(
    Schema.Struct({
      start: Schema.Number.pipe(Schema.int(), Schema.positive()),
      end: Schema.Number.pipe(Schema.int(), Schema.positive())
    })
  ),
  status: Schema.optional(Schema.Array(Schema.String.pipe(Schema.nonEmptyString())))
}).pipe(
  Schema.annotations({
    title: 'Search Filters',
    description: 'Filters to apply when searching'
  })
);

// Modal/Dialog schemas
export const ModalStateSchema = Schema.Struct({
  isOpen: Schema.Boolean,
  title: Schema.optional(Schema.String),
  size: Schema.optional(Schema.Literal('sm', 'md', 'lg', 'xl')),
  closable: Schema.optional(Schema.Boolean).pipe(Schema.withDecodingDefault(() => true)),
  data: Schema.optional(Schema.Unknown)
}).pipe(
  Schema.annotations({
    title: 'Modal State',
    description: 'State configuration for modals and dialogs'
  })
);

// Theme and preferences
export const ThemeSchema = Schema.Literal('light', 'dark', 'system').pipe(
  Schema.annotations({
    title: 'Theme',
    description: 'UI theme preference'
  })
);

export const UserPreferencesSchema = Schema.Struct({
  theme: ThemeSchema,
  language: Schema.String.pipe(Schema.length(2)), // ISO 639-1 language codes
  timezone: Schema.String.pipe(Schema.nonEmptyString()),
  notifications: Schema.Struct({
    enabled: Schema.Boolean,
    sound: Schema.Boolean,
    desktop: Schema.Boolean
  }),
  accessibility: Schema.Struct({
    reducedMotion: Schema.Boolean,
    highContrast: Schema.Boolean,
    fontSize: Schema.Literal('sm', 'md', 'lg', 'xl')
  })
}).pipe(
  Schema.annotations({
    title: 'User Preferences',
    description: 'User interface and accessibility preferences'
  })
);

// Export types
export type LoadingState = Schema.Schema.Type<typeof LoadingStateSchema>;
export type NotificationType = Schema.Schema.Type<typeof NotificationTypeSchema>;
export type Notification = Schema.Schema.Type<typeof NotificationSchema>;
export type Pagination = Schema.Schema.Type<typeof PaginationSchema>;
export type SortDirection = Schema.Schema.Type<typeof SortDirectionSchema>;
export type Sort = Schema.Schema.Type<typeof SortSchema>;
export type SearchFilters = Schema.Schema.Type<typeof SearchFiltersSchema>;
export type ModalState = Schema.Schema.Type<typeof ModalStateSchema>;
export type Theme = Schema.Schema.Type<typeof ThemeSchema>;
export type UserPreferences = Schema.Schema.Type<typeof UserPreferencesSchema>;
