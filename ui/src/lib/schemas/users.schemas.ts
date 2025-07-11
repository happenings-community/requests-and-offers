import { Schema as S } from 'effect';
import type { ActionHash, AgentPubKey } from '@holochain/client';

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
    S.String.pipe(S.maxLength(500, { message: () => 'Bio must be at most 500 characters' }))
  ),
  picture: S.optional(S.Uint8Array),
  user_type: UserTypeSchema,
  email: S.String.pipe(
    S.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: () => 'Please enter a valid email address' })
  ),
  phone: S.optional(
    S.String.pipe(
      S.pattern(/^\+?[\d\s\-\(\)]+$/, { message: () => 'Please enter a valid phone number' })
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

export const UserInputSchema = S.Struct({
  user: UserInDHTSchema,
  service_type_hashes: S.Array(S.Uint8Array).pipe(
    S.maxItems(20, { message: () => 'Maximum 20 service types allowed' })
  )
});
export type UserInput = S.Schema.Type<typeof UserInputSchema>;

export const UpdateUserInputSchema = S.Struct({
  original_action_hash: S.Uint8Array,
  previous_action_hash: S.Uint8Array,
  updated_user: UserInDHTSchema,
  service_type_hashes: S.Array(S.Uint8Array).pipe(
    S.maxItems(20, { message: () => 'Maximum 20 service types allowed' })
  )
});
export type UpdateUserInput = S.Schema.Type<typeof UpdateUserInputSchema>;

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
export const validateUserInput = S.decodeUnknown(UserInputSchema);

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
export const createUserInput = (data: Partial<UserInput>): UserInput => {
  const defaultUser: UserInDHT = {
    name: data.user?.name || '',
    nickname: data.user?.nickname || '',
    bio: data.user?.bio,
    picture: data.user?.picture,
    user_type: data.user?.user_type || 'advocate',
    email: data.user?.email || '',
    phone: data.user?.phone,
    time_zone: data.user?.time_zone,
    location: data.user?.location
  };

  return {
    user: { ...defaultUser, ...data.user },
    service_type_hashes: data.service_type_hashes || []
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
