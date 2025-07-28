import type { ActionHash, Link, Record } from '@holochain/client';
import { Context, Effect as E, Layer, pipe } from 'effect';
import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { OrganizationError } from '$lib/errors/organizations.errors';
import { ORGANIZATION_CONTEXTS } from '$lib/errors/error-contexts';
import type {
  OrganizationInDHT,
  UpdateOrganizationInput
} from '$lib/schemas/organizations.schemas';
import { AdministrationEntity } from '$lib/types/holochain';

// ============================================================================
// SERVICE TAG
// ============================================================================

export interface OrganizationsService {
  readonly createOrganization: (
    organization: OrganizationInDHT
  ) => E.Effect<Record, OrganizationError>;
  readonly getLatestOrganizationRecord: (
    original_action_hash: ActionHash
  ) => E.Effect<Record | null, OrganizationError>;
  readonly getAllOrganizationsLinks: () => E.Effect<Link[], OrganizationError>;
  readonly getOrganizationStatusLink: (
    organization_original_action_hash: ActionHash
  ) => E.Effect<Link | null, OrganizationError>;
  readonly getOrganizationMembersLinks: (
    organization_original_action_hash: ActionHash
  ) => E.Effect<Link[], OrganizationError>;
  readonly getOrganizationCoordinatorsLinks: (
    organization_original_action_hash: ActionHash
  ) => E.Effect<Link[], OrganizationError>;
  readonly addOrganizationMember: (
    organization_original_action_hash: ActionHash,
    user_original_action_hash: ActionHash
  ) => E.Effect<boolean, OrganizationError>;
  readonly removeOrganizationMember: (
    organization_original_action_hash: ActionHash,
    user_original_action_hash: ActionHash
  ) => E.Effect<boolean, OrganizationError>;
  readonly addOrganizationCoordinator: (
    organization_original_action_hash: ActionHash,
    user_original_action_hash: ActionHash
  ) => E.Effect<boolean, OrganizationError>;
  readonly removeOrganizationCoordinator: (
    organization_original_action_hash: ActionHash,
    user_original_action_hash: ActionHash
  ) => E.Effect<boolean, OrganizationError>;
  readonly getUserOrganizationsLinks: (
    user_original_action_hash: ActionHash
  ) => E.Effect<Link[], OrganizationError>;
  readonly getAcceptedOrganizationsLinks: () => E.Effect<Link[], OrganizationError>;
  readonly updateOrganization: (
    input: UpdateOrganizationInput
  ) => E.Effect<boolean, OrganizationError>;
  readonly deleteOrganization: (
    organization_original_action_hash: ActionHash
  ) => E.Effect<boolean, OrganizationError>;
  readonly leaveOrganization: (
    organization_original_action_hash: ActionHash
  ) => E.Effect<boolean, OrganizationError>;
  readonly isOrganizationCoordinator: (
    organization_original_action_hash: ActionHash,
    user_original_action_hash: ActionHash
  ) => E.Effect<boolean, OrganizationError>;
}

export class OrganizationsServiceTag extends Context.Tag('OrganizationsService')<
  OrganizationsServiceTag,
  OrganizationsService
>() {}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export const OrganizationsServiceLive: Layer.Layer<
  OrganizationsServiceTag,
  never,
  HolochainClientServiceTag
> = Layer.effect(
  OrganizationsServiceTag,
  E.gen(function* ($) {
    const holochainClient = yield* $(HolochainClientServiceTag);

    const createOrganization = (
      organization: OrganizationInDHT
    ): E.Effect<Record, OrganizationError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'users_organizations',
          'create_organization',
          organization
        ),
        E.map((result) => result as Record),
        E.mapError((error) =>
          OrganizationError.fromError(error, ORGANIZATION_CONTEXTS.CREATE_ORGANIZATION)
        )
      );

    const getLatestOrganizationRecord = (
      original_action_hash: ActionHash
    ): E.Effect<Record | null, OrganizationError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'users_organizations',
          'get_latest_organization_record',
          original_action_hash
        ),
        E.map((result) => result as Record | null),
        E.mapError((error) =>
          OrganizationError.fromError(error, ORGANIZATION_CONTEXTS.GET_ORGANIZATION)
        )
      );

    const getAllOrganizationsLinks = (): E.Effect<Link[], OrganizationError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'users_organizations',
          'get_all_organizations_links',
          null
        ),
        E.map((result) => result as Link[]),
        E.mapError((error) =>
          OrganizationError.fromError(error, ORGANIZATION_CONTEXTS.GET_ALL_ORGANIZATIONS)
        )
      );

    const getOrganizationStatusLink = (
      organization_original_action_hash: ActionHash
    ): E.Effect<Link | null, OrganizationError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'users_organizations',
          'get_organization_status_link',
          organization_original_action_hash
        ),
        E.map((result) => result as Link | null),
        E.mapError((error) =>
          OrganizationError.fromError(error, organization_original_action_hash.toString())
        )
      );

    const getOrganizationMembersLinks = (
      organization_original_action_hash: ActionHash
    ): E.Effect<Link[], OrganizationError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'users_organizations',
          'get_organization_members_links',
          organization_original_action_hash
        ),
        E.map((result) => result as Link[]),
        E.mapError((error) =>
          OrganizationError.fromError(error, organization_original_action_hash.toString())
        )
      );

    const getOrganizationCoordinatorsLinks = (
      organization_original_action_hash: ActionHash
    ): E.Effect<Link[], OrganizationError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'users_organizations',
          'get_organization_coordinators_links',
          organization_original_action_hash
        ),
        E.map((result) => result as Link[]),
        E.mapError((error) =>
          OrganizationError.fromError(error, organization_original_action_hash.toString())
        )
      );

    const addOrganizationMember = (
      organization_original_action_hash: ActionHash,
      user_original_action_hash: ActionHash
    ): E.Effect<boolean, OrganizationError> =>
      pipe(
        holochainClient.callZomeRawEffect('users_organizations', 'add_member_to_organization', {
          organization_original_action_hash,
          user_original_action_hash
        }),
        E.map((result) => result as boolean),
        E.mapError((error) =>
          OrganizationError.fromError(
            error,
            organization_original_action_hash.toString(),
            user_original_action_hash.toString()
          )
        )
      );

    const removeOrganizationMember = (
      organization_original_action_hash: ActionHash,
      user_original_action_hash: ActionHash
    ): E.Effect<boolean, OrganizationError> =>
      pipe(
        holochainClient.callZomeRawEffect('users_organizations', 'remove_organization_member', {
          organization_original_action_hash,
          user_original_action_hash
        }),
        E.map((result) => result as boolean),
        E.mapError((error) =>
          OrganizationError.fromError(
            error,
            organization_original_action_hash.toString(),
            user_original_action_hash.toString()
          )
        )
      );

    const addOrganizationCoordinator = (
      organization_original_action_hash: ActionHash,
      user_original_action_hash: ActionHash
    ): E.Effect<boolean, OrganizationError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'users_organizations',
          'add_coordinator_to_organization',
          {
            organization_original_action_hash,
            user_original_action_hash
          }
        ),
        E.map((result) => result as boolean),
        E.mapError((error) =>
          OrganizationError.fromError(
            error,
            organization_original_action_hash.toString(),
            user_original_action_hash.toString()
          )
        )
      );

    const removeOrganizationCoordinator = (
      organization_original_action_hash: ActionHash,
      user_original_action_hash: ActionHash
    ): E.Effect<boolean, OrganizationError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'users_organizations',
          'remove_organization_coordinator',
          {
            organization_original_action_hash,
            user_original_action_hash
          }
        ),
        E.map((result) => result as boolean),
        E.mapError((error) =>
          OrganizationError.fromError(
            error,
            organization_original_action_hash.toString(),
            user_original_action_hash.toString()
          )
        )
      );

    const getUserOrganizationsLinks = (
      user_original_action_hash: ActionHash
    ): E.Effect<Link[], OrganizationError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'users_organizations',
          'get_user_organizations_links',
          user_original_action_hash
        ),
        E.map((result) => result as Link[]),
        E.mapError((error) =>
          OrganizationError.fromError(error, user_original_action_hash.toString())
        )
      );

    const getAcceptedOrganizationsLinks = (): E.Effect<Link[], OrganizationError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'administration',
          'get_accepted_entities',
          AdministrationEntity.Organizations
        ),
        E.map((result) => result as Link[]),
        E.mapError((error) =>
          OrganizationError.fromError(error, ORGANIZATION_CONTEXTS.GET_ACCEPTED_ORGANIZATIONS)
        )
      );

    const updateOrganization = (
      input: UpdateOrganizationInput
    ): E.Effect<boolean, OrganizationError> =>
      pipe(
        holochainClient.callZomeRawEffect('users_organizations', 'update_organization', input),
        E.map((result) => result as boolean),
        E.mapError((error) =>
          OrganizationError.fromError(error, input.original_action_hash.toString())
        )
      );

    const deleteOrganization = (
      organization_original_action_hash: ActionHash
    ): E.Effect<boolean, OrganizationError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'users_organizations',
          'delete_organization',
          organization_original_action_hash
        ),
        E.map((result) => result as boolean),
        E.mapError((error) =>
          OrganizationError.fromError(error, organization_original_action_hash.toString())
        )
      );

    const leaveOrganization = (
      organization_original_action_hash: ActionHash
    ): E.Effect<boolean, OrganizationError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'users_organizations',
          'leave_organization',
          organization_original_action_hash
        ),
        E.map((result) => result as boolean),
        E.mapError((error) =>
          OrganizationError.fromError(error, organization_original_action_hash.toString())
        )
      );

    const isOrganizationCoordinator = (
      organization_original_action_hash: ActionHash,
      user_original_action_hash: ActionHash
    ): E.Effect<boolean, OrganizationError> =>
      pipe(
        holochainClient.callZomeRawEffect('users_organizations', 'is_organization_coordinator', {
          organization_original_action_hash,
          user_original_action_hash
        }),
        E.map((result) => result as boolean),
        E.mapError((error) =>
          OrganizationError.fromError(
            error,
            organization_original_action_hash?.toString() ?? 'unknown-org-hash',
            user_original_action_hash?.toString() ?? 'unknown-user-hash'
          )
        )
      );

    return OrganizationsServiceTag.of({
      createOrganization,
      getLatestOrganizationRecord,
      getAllOrganizationsLinks,
      getOrganizationStatusLink,
      getOrganizationMembersLinks,
      getOrganizationCoordinatorsLinks,
      addOrganizationMember,
      removeOrganizationMember,
      addOrganizationCoordinator,
      removeOrganizationCoordinator,
      getUserOrganizationsLinks,
      getAcceptedOrganizationsLinks,
      updateOrganization,
      deleteOrganization,
      leaveOrganization,
      isOrganizationCoordinator
    });
  })
);
