import { Schema } from 'effect';

// Form validation schemas
export const EmailSchema = Schema.String.pipe(
  Schema.minLength(1, { message: () => 'Email is required' }),
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: () => 'Please enter a valid email address'
  }),
  Schema.annotations({
    title: 'Email Address',
    description: 'A valid email address'
  })
);

export const PasswordSchema = Schema.String.pipe(
  Schema.minLength(8, { message: () => 'Password must be at least 8 characters' }),
  Schema.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: () =>
      'Password must contain at least one lowercase letter, one uppercase letter, and one number'
  }),
  Schema.annotations({
    title: 'Password',
    description: 'A secure password with minimum requirements'
  })
);

export const UsernameSchema = Schema.String.pipe(
  Schema.minLength(3, { message: () => 'Username must be at least 3 characters' }),
  Schema.maxLength(30, { message: () => 'Username must be less than 30 characters' }),
  Schema.pattern(/^[a-zA-Z0-9_-]+$/, {
    message: () => 'Username can only contain letters, numbers, underscores, and hyphens'
  }),
  Schema.annotations({
    title: 'Username',
    description: 'A valid username for the application'
  })
);

// Request/Offer specific schemas
export const TitleSchema = Schema.Trim.pipe(
  Schema.minLength(1, { message: () => 'Title is required' }),
  Schema.maxLength(100, { message: () => 'Title must be less than 100 characters' }),
  Schema.annotations({
    title: 'Title',
    description: 'Title for a request or offer'
  })
);

export const DescriptionSchema = Schema.Trim.pipe(
  Schema.minLength(10, { message: () => 'Description must be at least 10 characters' }),
  Schema.maxLength(1000, { message: () => 'Description must be less than 1000 characters' }),
  Schema.annotations({
    title: 'Description',
    description: 'Detailed description for a request or offer'
  })
);

export const TagSchema = Schema.String.pipe(
  Schema.minLength(1, { message: () => 'Tag cannot be empty' }),
  Schema.maxLength(20, { message: () => 'Tag must be less than 20 characters' }),
  Schema.pattern(/^[a-zA-Z0-9-_]+$/, {
    message: () => 'Tags can only contain letters, numbers, hyphens, and underscores'
  }),
  Schema.transform(Schema.String, {
    strict: true,
    decode: (s) => s.toLowerCase().trim(),
    encode: (s) => s
  }),
  Schema.annotations({
    title: 'Tag',
    description: 'A tag for categorizing requests and offers'
  })
);

export const TagsSchema = Schema.Array(TagSchema).pipe(
  Schema.maxItems(10, { message: () => 'Maximum 10 tags allowed' }),
  Schema.annotations({
    title: 'Tags',
    description: 'Array of tags for categorization'
  })
);

// Enhanced Request Form Schema - Aligned with RequestInput for comprehensive validation
export const CreateRequestFormSchema = Schema.Struct({
  title: TitleSchema,
  description: DescriptionSchema,
  // TODO: Replace with comprehensive request fields following RequestInput schema
  // This schema will be updated to include all RequestInput fields for consistency
  tags: Schema.optional(TagsSchema).pipe(Schema.withDecodingDefault(() => [])),
  urgency: Schema.optional(Schema.Literal('low', 'medium', 'high')),
  location: Schema.optional(Schema.String.pipe(Schema.maxLength(100)))
}).pipe(
  Schema.annotations({
    title: 'Create Request Form',
    description:
      'Form data for creating a new request (will be enhanced with full RequestInput fields)'
  })
);

export const CreateOfferFormSchema = Schema.Struct({
  title: TitleSchema,
  description: DescriptionSchema,
  tags: Schema.optional(TagsSchema).pipe(Schema.withDecodingDefault(() => [])),
  availability: Schema.optional(Schema.Literal('immediate', 'flexible', 'scheduled')),
  location: Schema.optional(Schema.String.pipe(Schema.maxLength(100)))
}).pipe(
  Schema.annotations({
    title: 'Create Offer Form',
    description: 'Form data for creating a new offer'
  })
);

export const LoginFormSchema = Schema.Struct({
  email: EmailSchema,
  password: Schema.String.pipe(Schema.minLength(1, { message: () => 'Password is required' }))
}).pipe(
  Schema.annotations({
    title: 'Login Form',
    description: 'Form data for user login'
  })
);

export const RegisterFormSchema = Schema.Struct({
  username: UsernameSchema,
  email: EmailSchema,
  password: PasswordSchema,
  confirmPassword: Schema.String.pipe(
    Schema.minLength(1, { message: () => 'Please confirm your password' })
  )
}).pipe(
  Schema.filter((data) =>
    data.password === data.confirmPassword ? undefined : 'Passwords do not match'
  ),
  Schema.annotations({
    title: 'Register Form',
    description: 'Form data for user registration'
  })
);

// Search and filter schemas
export const SearchQuerySchema = Schema.Trim.pipe(
  Schema.maxLength(100, { message: () => 'Search query must be less than 100 characters' }),
  Schema.annotations({
    title: 'Search Query',
    description: 'Search query string'
  })
);

export const FilterOptionsSchema = Schema.Struct({
  tags: Schema.optional(TagsSchema),
  urgency: Schema.optional(Schema.Literal('low', 'medium', 'high')),
  availability: Schema.optional(Schema.Literal('immediate', 'flexible', 'scheduled')),
  location: Schema.optional(Schema.String.pipe(Schema.maxLength(100))),
  dateRange: Schema.optional(
    Schema.Struct({
      start: Schema.Date,
      end: Schema.Date
    })
  )
}).pipe(
  Schema.annotations({
    title: 'Filter Options',
    description: 'Options for filtering requests and offers'
  })
);
