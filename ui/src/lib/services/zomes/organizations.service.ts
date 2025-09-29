import type { ActionHash, Link, Record } from '@holochain/client';
import { Context, Effect as E, Layer } from 'effect';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { OrganizationError } from '$lib/errors/organizations.errors';
import { ORGANIZATION_CONTEXTS } from '$lib/errors/error-contexts';
import type {
  OrganizationInDHT,
  UpdateOrganizationInput
} from '$lib/schemas/organizations.schemas';
import { AdministrationEntity } from '$lib/types/holochain';
import { wrapZomeCallWithErrorFactory } from '$lib/utils/zome-helpers';

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
  E.gen(function* () {
    const holochainClient = yield* HolochainClientServiceTag;

    // Helper to wrap Promise-based methods in Effect
    const wrapZomeCall = <T>(
      zomeName: string,
      fnName: string,
      payload: unknown,
      context: string = ORGANIZATION_CONTEXTS.CREATE_ORGANIZATION
    ): E.Effect<T, OrganizationError> =>
      wrapZomeCallWithErrorFactory(
        holochainClient,
        zomeName,
        fnName,
        payload,
        context,
        OrganizationError.fromError
      );

    const createOrganization = (
      organization: OrganizationInDHT
    ): E.Effect<Record, OrganizationError> =>
      wrapZomeCall('users_organizations', 'create_organization', organization);

    const getLatestOrganizationRecord = (
      original_action_hash: ActionHash
    ): E.Effect<Record | null, OrganizationError> =>
      wrapZomeCall('users_organizations', 'get_latest_organization_record', original_action_hash);

    const getAllOrganizationsLinks = (): E.Effect<Link[], OrganizationError> =>
      wrapZomeCall('users_organizations', 'get_all_organizations_links', null);

    const getOrganizationStatusLink = (
      organization_original_action_hash: ActionHash
    ): E.Effect<Link | null, OrganizationError> =>
      wrapZomeCall(
        'users_organizations',
        'get_organization_status_link',
        organization_original_action_hash
      );

    const getOrganizationMembersLinks = (
      organization_original_action_hash: ActionHash
    ): E.Effect<Link[], OrganizationError> =>
      wrapZomeCall(
        'users_organizations',
        'get_organization_members_links',
        organization_original_action_hash
      );

    const getOrganizationCoordinatorsLinks = (
      organization_original_action_hash: ActionHash
    ): E.Effect<Link[], OrganizationError> =>
      wrapZomeCall(
        'users_organizations',
        'get_organization_coordinators_links',
        organization_original_action_hash
      );

    const addOrganizationMember = (
      organization_original_action_hash: ActionHash,
      user_original_action_hash: ActionHash
    ): E.Effect<boolean, OrganizationError> =>
      wrapZomeCall('users_organizations', 'add_member_to_organization', {
        organization_original_action_hash,
        user_original_action_hash
      });

    const removeOrganizationMember = (
      organization_original_action_hash: ActionHash,
      user_original_action_hash: ActionHash
    ): E.Effect<boolean, OrganizationError> =>
      wrapZomeCall('users_organizations', 'remove_organization_member', {
        organization_original_action_hash,
        user_original_action_hash
      });

    const addOrganizationCoordinator = (
      organization_original_action_hash: ActionHash,
      user_original_action_hash: ActionHash
    ): E.Effect<boolean, OrganizationError> =>
      wrapZomeCall('users_organizations', 'add_coordinator_to_organization', {
        organization_original_action_hash,
        user_original_action_hash
      });

    const removeOrganizationCoordinator = (
      organization_original_action_hash: ActionHash,
      user_original_action_hash: ActionHash
    ): E.Effect<boolean, OrganizationError> =>
      wrapZomeCall('users_organizations', 'remove_organization_coordinator', {
        organization_original_action_hash,
        user_original_action_hash
      });

    const getUserOrganizationsLinks = (
      user_original_action_hash: ActionHash
    ): E.Effect<Link[], OrganizationError> =>
      wrapZomeCall(
        'users_organizations',
        'get_user_organizations_links',
        user_original_action_hash
      );

    const getAcceptedOrganizationsLinks = (): E.Effect<Link[], OrganizationError> =>
      wrapZomeCall('administration', 'get_accepted_entities', AdministrationEntity.Organizations);

    const updateOrganization = (
      input: UpdateOrganizationInput
    ): E.Effect<boolean, OrganizationError> =>
      wrapZomeCall('users_organizations', 'update_organization', input);

    const deleteOrganization = (
      organization_original_action_hash: ActionHash
    ): E.Effect<boolean, OrganizationError> =>
      wrapZomeCall('users_organizations', 'delete_organization', organization_original_action_hash);

    const leaveOrganization = (
      organization_original_action_hash: ActionHash
    ): E.Effect<boolean, OrganizationError> =>
      wrapZomeCall('users_organizations', 'leave_organization', organization_original_action_hash);

    const isOrganizationCoordinator = (
      organization_original_action_hash: ActionHash,
      user_original_action_hash: ActionHash
    ): E.Effect<boolean, OrganizationError> =>
      wrapZomeCall('users_organizations', 'is_organization_coordinator', {
        organization_original_action_hash,
        user_original_action_hash
      });

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
