import { Schema as S } from 'effect';

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const UserTypeSchema = S.Literal('creator', 'advocate');
export type UserType = S.Schema.Type<typeof UserTypeSchema>;

export const StatusTypeSchema = S.Literal(
  'pending',
  'accepted',
  'rejected',
  'suspended temporarily',
  'suspended indefinitely'
);
export type StatusType = S.Schema.Type<typeof StatusTypeSchema>;

export const OrganizationRoleSchema = S.Literal('member', 'coordinator');
export type OrganizationRole = S.Schema.Type<typeof OrganizationRoleSchema>;

// ============================================================================
// CORE DATA SCHEMAS
// ============================================================================

export const StatusInDHTSchema = S.Struct({
  status_type: StatusTypeSchema,
  reason: S.optional(S.String),
  suspended_until: S.optional(S.String)
});
export type StatusInDHT = S.Schema.Type<typeof StatusInDHTSchema>;

export const UserInDHTSchema = S.Struct({
  name: S.String.pipe(
    S.minLength(1, { message: () => 'Name must not be empty' }),
    S.maxLength(100, { message: () => 'Name must be at most 100 characters' })
  ),
  nickname: S.String.pipe(
    S.minLength(1, { message: () => 'Nickname must not be empty' }),
    S.maxLength(50, { message: () => 'Nickname must be at most 50 characters' })
  ),
  bio: S.optional(
    S.String.pipe(S.maxLength(1000, { message: () => 'Bio must be at most 1000 characters' }))
  ),
  picture: S.optional(S.Uint8Array),
  user_type: UserTypeSchema,
  email: S.String.pipe(
    S.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: () => 'Please enter a valid email address' })
  ),
  phone: S.optional(
    S.String.pipe(
      S.pattern(/^\+?[\d\s\-()]+$/, { message: () => 'Please enter a valid phone number' })
    )
  ),
  time_zone: S.optional(S.String),
  location: S.optional(
    S.String.pipe(S.maxLength(200, { message: () => 'Location must be at most 200 characters' }))
  )
});
export type UserInDHT = S.Schema.Type<typeof UserInDHTSchema>;

// ============================================================================
// UI SCHEMAS
// ============================================================================

export const UIStatusSchema = StatusInDHTSchema.pipe(
  S.extend(
    S.Struct({
      duration: S.optional(S.Number),
      original_action_hash: S.optional(S.Uint8Array),
      previous_action_hash: S.optional(S.Uint8Array)
    })
  )
);
export type UIStatus = S.Schema.Type<typeof UIStatusSchema>;

export const RevisionSchema = S.Struct({
  revision_id: S.String,
  author: S.Uint8Array,
  timestamp: S.Number,
  entry_hash: S.Uint8Array,
  entry_type: S.String,
  action: S.Union(S.Literal('Create'), S.Literal('Update'), S.Literal('Delete'))
});
export type Revision = S.Schema.Type<typeof RevisionSchema>;

export const UIUserSchema = UserInDHTSchema.pipe(
  S.extend(
    S.Struct({
      agents: S.optional(S.Array(S.Uint8Array)),
      remaining_time: S.optional(S.Number),
      original_action_hash: S.optional(S.Uint8Array),
      previous_action_hash: S.optional(S.Uint8Array),
      status: S.optional(UIStatusSchema),
      status_history: S.optional(S.Array(RevisionSchema)),
      organizations: S.optional(S.Array(S.Uint8Array)),
      role: S.optional(OrganizationRoleSchema),
      service_type_hashes: S.optional(S.Array(S.Uint8Array))
    })
  )
);
export type UIUser = S.Schema.Type<typeof UIUserSchema>;

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const UpdateUserInputSchema = S.Struct({
  original_action_hash: S.Uint8Array,
  previous_action_hash: S.Uint8Array,
  updated_user: UserInDHTSchema
});
export type UpdateUserInput = S.Schema.Type<typeof UpdateUserInputSchema>;

// ============================================================================
// FORM SCHEMAS
// ============================================================================

/**
 * Form input shape for the user profile form.
 *
 * Splits the DHT `name` field into `given_name` and `family_name` for
 * collection. The DHT struct itself is unchanged — concatenation happens
 * at submit time via `formInputToDHT`.
 *
 * Both fields are required. Mononymous users are asked to enter "." in the
 * second field as an explicit declaration; the dot is stripped at display
 * time by `formatUserName`.
 */
export const UserFormInputSchema = S.Struct({
  given_name: S.String.pipe(
    S.minLength(1, { message: () => 'Given name must not be empty' }),
    S.maxLength(100, { message: () => 'Given name must be at most 100 characters' })
  ),
  family_name: S.String.pipe(
    S.minLength(1, {
      message: () => 'Family name must not be empty (use "." if you have a single name)'
    }),
    S.maxLength(100, { message: () => 'Family name must be at most 100 characters' })
  ),
  nickname: S.String.pipe(
    S.minLength(1, { message: () => 'Nickname must not be empty' }),
    S.maxLength(50, { message: () => 'Nickname must be at most 50 characters' })
  ),
  bio: S.optional(
    S.String.pipe(S.maxLength(1000, { message: () => 'Bio must be at most 1000 characters' }))
  ),
  picture: S.optional(S.Uint8Array),
  user_type: UserTypeSchema,
  email: S.String.pipe(
    S.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: () => 'Please enter a valid email address' })
  ),
  phone: S.optional(
    S.String.pipe(
      S.pattern(/^\+?[\d\s\-()]+$/, { message: () => 'Please enter a valid phone number' })
    )
  ),
  time_zone: S.optional(S.String),
  location: S.optional(
    S.String.pipe(S.maxLength(200, { message: () => 'Location must be at most 200 characters' }))
  )
});
export type UserFormInput = S.Schema.Type<typeof UserFormInputSchema>;

/**
 * Transformation: form input → DHT shape.
 *
 * Concatenates given_name and family_name with a single space. For
 * mononymous users this produces e.g. "Sting ." — the trailing dot is a
 * vetting marker in stored data and is stripped at display time.
 */
export const formInputToDHT = (input: UserFormInput): UserInDHT => ({
  name: `${input.given_name.trim()} ${input.family_name.trim()}`,
  nickname: input.nickname,
  bio: input.bio,
  picture: input.picture,
  user_type: input.user_type,
  email: input.email,
  phone: input.phone,
  time_zone: input.time_zone,
  location: input.location
});

/**
 * Reverse transformation: DHT → form input (for edit-mode pre-fill).
 *
 * Uses first-space split to preserve compound family names common in
 * Spanish, Portuguese, Dutch and Arabic naming conventions (e.g.
 * "Maria del Carmen Rodriguez" → given: "Maria", family: "del Carmen Rodriguez").
 *
 * For mononymous users (single token, no space) the family_name is left
 * empty rather than pre-filled with a dot — so editing makes mononymism a
 * deliberate user choice rather than inherited form state.
 */
export const dhtToFormInput = (user: UserInDHT): UserFormInput => {
  const trimmed = user.name.trim();
  const firstSpace = trimmed.indexOf(' ');
  const given_name = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
  const family_name = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1).trim();
  return {
    given_name,
    family_name,
    nickname: user.nickname,
    bio: user.bio,
    picture: user.picture,
    user_type: user.user_type,
    email: user.email,
    phone: user.phone,
    time_zone: user.time_zone,
    location: user.location
  };
};

// ============================================================================
// SERVICE OPERATION SCHEMAS
// ============================================================================

export const GetUserAgentsInputSchema = S.Struct({
  user_original_action_hash: S.Uint8Array
});
export type GetUserAgentsInput = S.Schema.Type<typeof GetUserAgentsInputSchema>;

export const GetUserStatusLinkInputSchema = S.Struct({
  user_original_action_hash: S.Uint8Array
});
export type GetUserStatusLinkInput = S.Schema.Type<typeof GetUserStatusLinkInputSchema>;

export const GetAgentUserInputSchema = S.Struct({
  agent: S.Uint8Array
});
export type GetAgentUserInput = S.Schema.Type<typeof GetAgentUserInputSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const VoidResponseSchema = S.Void;
export const BooleanResponseSchema = S.Boolean;
export const StringArraySchema = S.Array(S.String);
export const ActionHashArraySchema = S.Array(S.Uint8Array);
export const AgentPubKeyArraySchema = S.Array(S.Uint8Array);

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates user input data for form submission
 */
export const validateUserInput = S.decodeUnknown(UserInDHTSchema);

/**
 * Validates update user input data
 */
export const validateUpdateUserInput = S.decodeUnknown(UpdateUserInputSchema);

/**
 * Validates UI user data for display
 */
export const validateUIUser = S.decodeUnknown(UIUserSchema);

/**
 * Creates a safe user input object with defaults
 */
export const createUserInput = (data: Partial<UserInDHT>): UserInDHT => {
  const defaultUser: UserInDHT = {
    name: data.name || '',
    nickname: data.nickname || '',
    bio: data.bio,
    picture: data.picture,
    user_type: data.user_type || 'advocate',
    email: data.email || '',
    phone: data.phone,
    time_zone: data.time_zone,
    location: data.location
  };

  return {
    ...defaultUser,
    ...data
  };
};

/**
 * Creates a safe UI user object with defaults
 */
export const createUIUser = (data: Partial<UIUser>): UIUser => {
  const defaultUser: UserInDHT = {
    name: data.name || '',
    nickname: data.nickname || '',
    bio: data.bio,
    picture: data.picture,
    user_type: data.user_type || 'advocate',
    email: data.email || '',
    phone: data.phone,
    time_zone: data.time_zone,
    location: data.location
  };

  return {
    ...defaultUser,
    agents: data.agents,
    remaining_time: data.remaining_time,
    original_action_hash: data.original_action_hash,
    previous_action_hash: data.previous_action_hash,
    status: data.status,
    status_history: data.status_history,
    organizations: data.organizations,
    role: data.role,
    service_type_hashes: data.service_type_hashes
  };
};

/**
 * Strips the sentinel dot used to mark mononymous users.
 *
 * A user who entered just "Sting" with "." in the family_name field has
 * `name: "Sting ."` stored in the DHT. The dot is a vetting marker only —
 * it should never appear in the UI. This function strips it (and a
 * defensive leading variant) for display.
 *
 * Embedded dots (initials like "J. R. R. Tolkien", titles like "Dr. Smith")
 * are preserved because they don't match the boundary patterns.
 */
export const formatUserName = (name: string | null | undefined): string => {
  if (!name) return '';
  return name
    .replace(/\s\.\s*$/, '') // strip " ." at end (primary sentinel)
    .replace(/^\s*\.\s/, '') // strip ". " at start (defensive)
    .trim();
};
