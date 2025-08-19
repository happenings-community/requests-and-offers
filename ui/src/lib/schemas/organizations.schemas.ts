import { Schema as S } from 'effect';
import type { ActionHash } from '@holochain/client';

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const OrganizationRoleSchema = S.Literal('member', 'coordinator');
export type OrganizationRole = S.Schema.Type<typeof OrganizationRoleSchema>;

export const StatusTypeSchema = S.Literal(
  'pending',
  'accepted',
  'rejected',
  'suspended temporarily',
  'suspended indefinitely'
);
export type StatusType = S.Schema.Type<typeof StatusTypeSchema>;

// ============================================================================
// CORE DATA SCHEMAS
// ============================================================================

export const OrganizationInDHTSchema = S.Struct({
  name: S.String.pipe(
    S.minLength(1, { message: () => 'Organization name must not be empty' }),
    S.maxLength(100, { message: () => 'Organization name must be at most 100 characters' })
  ),
  description: S.String.pipe(
    S.minLength(1, { message: () => 'Vision/Mission must not be empty' }),
    S.maxLength(500, { message: () => 'Vision/Mission must be at most 500 characters' })
  ),
  full_legal_name: S.String.pipe(
    S.minLength(1, { message: () => 'Full legal name must not be empty' }),
    S.maxLength(200, { message: () => 'Full legal name must be at most 200 characters' })
  ),
  logo: S.optional(S.Uint8Array),
  email: S.String.pipe(
    S.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: () => 'Please enter a valid email address' })
  ),
  urls: S.Array(
    S.String.pipe(
      S.pattern(/^https?:\/\/.+/, {
        message: () => 'Please enter valid URLs starting with http:// or https://'
      })
    )
  ).pipe(S.maxItems(10, { message: () => 'Maximum 10 URLs allowed' })),
  location: S.String.pipe(
    S.minLength(1, { message: () => 'Location must not be empty' }),
    S.maxLength(200, { message: () => 'Location must be at most 200 characters' })
  )
});
export type OrganizationInDHT = S.Schema.Type<typeof OrganizationInDHTSchema>;

export const StatusInDHTSchema = S.Struct({
  status_type: StatusTypeSchema,
  reason: S.optional(S.String),
  suspended_until: S.optional(S.String)
});
export type StatusInDHT = S.Schema.Type<typeof StatusInDHTSchema>;

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

export const UIOrganizationSchema = OrganizationInDHTSchema.pipe(
  S.extend(
    S.Struct({
      members: S.Array(S.Uint8Array),
      coordinators: S.Array(S.Uint8Array),
      status: S.optional(UIStatusSchema),
      original_action_hash: S.optional(S.Uint8Array),
      previous_action_hash: S.optional(S.Uint8Array)
    })
  )
);
export type UIOrganization = S.Schema.Type<typeof UIOrganizationSchema>;

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const CreateOrganizationInputSchema = S.Struct({
  organization: OrganizationInDHTSchema
});
export type CreateOrganizationInput = S.Schema.Type<typeof CreateOrganizationInputSchema>;

export const UpdateOrganizationInputSchema = S.Struct({
  original_action_hash: S.Uint8Array,
  previous_action_hash: S.Uint8Array,
  updated_organization: OrganizationInDHTSchema
});
export type UpdateOrganizationInput = S.Schema.Type<typeof UpdateOrganizationInputSchema>;

export const OrganizationMemberInputSchema = S.Struct({
  organization_original_action_hash: S.Uint8Array,
  user_original_action_hash: S.Uint8Array
});
export type OrganizationMemberInput = S.Schema.Type<typeof OrganizationMemberInputSchema>;

export const OrganizationCoordinatorInputSchema = S.Struct({
  organization_original_action_hash: S.Uint8Array,
  user_original_action_hash: S.Uint8Array
});
export type OrganizationCoordinatorInput = S.Schema.Type<typeof OrganizationCoordinatorInputSchema>;

export const IsOrganizationCoordinatorInputSchema = S.Struct({
  organization_original_action_hash: S.Uint8Array,
  user_original_action_hash: S.Uint8Array
});
export type IsOrganizationCoordinatorInput = S.Schema.Type<
  typeof IsOrganizationCoordinatorInputSchema
>;

// ============================================================================
// SERVICE OPERATION SCHEMAS
// ============================================================================

export const GetOrganizationStatusLinkInputSchema = S.Struct({
  organization_original_action_hash: S.Uint8Array
});
export type GetOrganizationStatusLinkInput = S.Schema.Type<
  typeof GetOrganizationStatusLinkInputSchema
>;

export const GetOrganizationMembersInputSchema = S.Struct({
  organization_original_action_hash: S.Uint8Array
});
export type GetOrganizationMembersInput = S.Schema.Type<typeof GetOrganizationMembersInputSchema>;

export const GetOrganizationCoordinatorsInputSchema = S.Struct({
  organization_original_action_hash: S.Uint8Array
});
export type GetOrganizationCoordinatorsInput = S.Schema.Type<
  typeof GetOrganizationCoordinatorsInputSchema
>;

export const GetUserOrganizationsInputSchema = S.Struct({
  user_original_action_hash: S.Uint8Array
});
export type GetUserOrganizationsInput = S.Schema.Type<typeof GetUserOrganizationsInputSchema>;

export const DeleteOrganizationInputSchema = S.Struct({
  organization_original_action_hash: S.Uint8Array
});
export type DeleteOrganizationInput = S.Schema.Type<typeof DeleteOrganizationInputSchema>;

export const LeaveOrganizationInputSchema = S.Struct({
  organization_original_action_hash: S.Uint8Array
});
export type LeaveOrganizationInput = S.Schema.Type<typeof LeaveOrganizationInputSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const VoidResponseSchema = S.Void;
export const BooleanResponseSchema = S.Boolean;
export const StringArraySchema = S.Array(S.String);
export const ActionHashArraySchema = S.Array(S.Uint8Array);

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates organization input data for form submission
 */
export const validateCreateOrganizationInput = S.decodeUnknown(CreateOrganizationInputSchema);

/**
 * Validates update organization input data
 */
export const validateUpdateOrganizationInput = S.decodeUnknown(UpdateOrganizationInputSchema);

/**
 * Validates UI organization data for display
 */
export const validateUIOrganization = S.decodeUnknown(UIOrganizationSchema);

/**
 * Validates organization member operations
 */
export const validateOrganizationMemberInput = S.decodeUnknown(OrganizationMemberInputSchema);

/**
 * Validates organization coordinator operations
 */
export const validateOrganizationCoordinatorInput = S.decodeUnknown(
  OrganizationCoordinatorInputSchema
);

/**
 * Creates a safe organization input object with defaults
 */
export const createOrganizationInput = (
  data: Partial<CreateOrganizationInput>
): CreateOrganizationInput => {
  const defaultOrganization: OrganizationInDHT = {
    name: data.organization?.name || '',
    description: data.organization?.description || '',
    full_legal_name: data.organization?.full_legal_name || '',
    logo: data.organization?.logo,
    email: data.organization?.email || '',
    urls: data.organization?.urls || [],
    location: data.organization?.location || ''
  };

  return {
    organization: { ...defaultOrganization, ...data.organization }
  };
};

/**
 * Creates a safe UI organization object with defaults
 */
export const createUIOrganization = (data: Partial<UIOrganization>): UIOrganization => {
  const defaultOrganization: OrganizationInDHT = {
    name: data.name || '',
    description: data.description || '',
    full_legal_name: data.full_legal_name || '',
    logo: data.logo,
    email: data.email || '',
    urls: data.urls || [],
    location: data.location || ''
  };

  return {
    ...defaultOrganization,
    members: data.members || [],
    coordinators: data.coordinators || [],
    status: data.status,
    original_action_hash: data.original_action_hash,
    previous_action_hash: data.previous_action_hash
  };
};

/**
 * Creates a safe organization member input
 */
export const createOrganizationMemberInput = (
  organizationHash: ActionHash,
  userHash: ActionHash
): OrganizationMemberInput => ({
  organization_original_action_hash: organizationHash,
  user_original_action_hash: userHash
});

/**
 * Creates a safe organization coordinator input
 */
export const createOrganizationCoordinatorInput = (
  organizationHash: ActionHash,
  userHash: ActionHash
): OrganizationCoordinatorInput => ({
  organization_original_action_hash: organizationHash,
  user_original_action_hash: userHash
});

/**
 * Creates a safe update organization input
 */
export const createUpdateOrganizationInput = (
  originalHash: ActionHash,
  previousHash: ActionHash,
  organization: OrganizationInDHT
): UpdateOrganizationInput => ({
  original_action_hash: originalHash,
  previous_action_hash: previousHash,
  updated_organization: organization
});
