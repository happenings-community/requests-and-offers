import type { ActionHash, Link, Record, AgentPubKey } from '@holochain/client';
import { Context, Effect as E, Layer, pipe } from 'effect';
import { AdministrationError } from '$lib/errors/administration.errors';
import { ADMINISTRATION_CONTEXTS } from '$lib/errors/error-contexts';
import { HolochainClientServiceTag } from '../HolochainClientService.svelte';
import {
  type RegisterAdministratorInput,
  type AddAdministratorInput,
  type RemoveAdministratorInput,
  type CheckAdministratorInput,
  type UpdateEntityStatusInput,
  type GetEntityStatusInput
} from '$lib/schemas/administration.schemas';
import { AdministrationEntity, type StatusInDHT } from '$lib/types/holochain';
import { wrapZomeCallWithErrorFactory } from '$lib/utils/zome-helpers';

// ============================================================================
// SERVICE INTERFACE
// ============================================================================

export interface AdministrationService {
  readonly getAllUsersLinks: () => E.Effect<Link[], AdministrationError, never>;
  readonly getAllOrganizationsLinks: () => E.Effect<Link[], AdministrationError, never>;
  readonly registerAdministrator: (
    input: RegisterAdministratorInput
  ) => E.Effect<boolean, AdministrationError, never>;
  readonly addAdministrator: (
    input: AddAdministratorInput
  ) => E.Effect<boolean, AdministrationError, never>;
  readonly removeAdministrator: (
    input: RemoveAdministratorInput
  ) => E.Effect<boolean, AdministrationError, never>;
  readonly getAllAdministratorsLinks: (
    entity: AdministrationEntity
  ) => E.Effect<Link[], AdministrationError, never>;
  readonly createStatus: (status: StatusInDHT) => E.Effect<Record, AdministrationError, never>;
  readonly getLatestStatusRecord: (
    original_action_hash: ActionHash
  ) => E.Effect<Record | null, AdministrationError, never>;
  readonly registerNetworkAdministrator: (
    entity_original_action_hash: ActionHash,
    agent_pubkeys: AgentPubKey[]
  ) => E.Effect<boolean, AdministrationError, never>;
  readonly checkIfAgentIsAdministrator: (
    input: CheckAdministratorInput
  ) => E.Effect<boolean, AdministrationError, never>;
  readonly getAllRevisionsForStatus: (
    status_original_action_hash: ActionHash
  ) => E.Effect<Record[], AdministrationError, never>;
  readonly updateEntityStatus: (
    input: UpdateEntityStatusInput
  ) => E.Effect<Record, AdministrationError, never>;
  readonly getLatestStatusRecordForEntity: (
    input: GetEntityStatusInput
  ) => E.Effect<Record | null, AdministrationError, never>;
}

// ============================================================================
// SERVICE TAG
// ============================================================================

export class AdministrationServiceTag extends Context.Tag('AdministrationService')<
  AdministrationServiceTag,
  AdministrationService
>() {}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export const AdministrationServiceLive = Layer.effect(
  AdministrationServiceTag,
  E.gen(function* () {
    const hcService = yield* HolochainClientServiceTag;

    // Helper to wrap Promise-based methods in Effect
    const wrapZomeCall = <T>(
      zomeName: string,
      fnName: string,
      payload: unknown,
      context: string = ADMINISTRATION_CONTEXTS.GET_ALL_USERS
    ): E.Effect<T, AdministrationError> =>
      wrapZomeCallWithErrorFactory(
        hcService,
        zomeName,
        fnName,
        payload,
        context,
        AdministrationError.fromError
      );

    const getAllUsersLinks = (): E.Effect<Link[], AdministrationError, never> =>
      wrapZomeCall('users_organizations', 'get_all_users', null);

    const getAllOrganizationsLinks = (): E.Effect<Link[], AdministrationError, never> =>
      wrapZomeCall('users_organizations', 'get_all_organizations_links', null);

    const registerAdministrator = (
      input: RegisterAdministratorInput
    ): E.Effect<boolean, AdministrationError, never> =>
      wrapZomeCall('administration', 'register_administrator', input);

    const addAdministrator = (
      input: AddAdministratorInput
    ): E.Effect<boolean, AdministrationError, never> =>
      wrapZomeCall('administration', 'add_administrator', input);

    const removeAdministrator = (
      input: RemoveAdministratorInput
    ): E.Effect<boolean, AdministrationError, never> =>
      wrapZomeCall('administration', 'remove_administrator', input);

    const getAllAdministratorsLinks = (
      entity: AdministrationEntity
    ): E.Effect<Link[], AdministrationError, never> =>
      wrapZomeCall('administration', 'get_all_administrators_links', entity);

    const createStatus = (status: StatusInDHT): E.Effect<Record, AdministrationError, never> =>
      wrapZomeCall('administration', 'create_status', status);

    const getLatestStatusRecord = (
      original_action_hash: ActionHash
    ): E.Effect<Record | null, AdministrationError, never> =>
      wrapZomeCall('administration', 'get_latest_status_record', original_action_hash);

    const registerNetworkAdministrator = (
      entity_original_action_hash: ActionHash,
      agent_pubkeys: AgentPubKey[]
    ): E.Effect<boolean, AdministrationError, never> =>
      pipe(
        registerAdministrator({
          entity: AdministrationEntity.Network,
          entity_original_action_hash,
          agent_pubkeys
        }),
        E.mapError((error) =>
          AdministrationError.fromError(
            error,
            ADMINISTRATION_CONTEXTS.ADD_ADMINISTRATOR,
            entity_original_action_hash.toString()
          )
        )
      );

    const checkIfAgentIsAdministrator = (
      input: CheckAdministratorInput
    ): E.Effect<boolean, AdministrationError, never> =>
      wrapZomeCall('administration', 'check_if_agent_is_administrator', input);

    const getAllRevisionsForStatus = (
      status_original_action_hash: ActionHash
    ): E.Effect<Record[], AdministrationError, never> =>
      wrapZomeCall('administration', 'get_all_revisions_for_status', status_original_action_hash);

    const updateEntityStatus = (
      input: UpdateEntityStatusInput
    ): E.Effect<Record, AdministrationError, never> =>
      wrapZomeCall('administration', 'update_entity_status', input);

    const getLatestStatusRecordForEntity = (
      input: GetEntityStatusInput
    ): E.Effect<Record | null, AdministrationError, never> =>
      wrapZomeCall('administration', 'get_latest_status_record_for_entity', input);

    return AdministrationServiceTag.of({
      getAllUsersLinks,
      getAllOrganizationsLinks,
      registerAdministrator,
      addAdministrator,
      removeAdministrator,
      getAllAdministratorsLinks,
      createStatus,
      getLatestStatusRecord,
      registerNetworkAdministrator,
      checkIfAgentIsAdministrator,
      getAllRevisionsForStatus,
      updateEntityStatus,
      getLatestStatusRecordForEntity
    });
  })
);
