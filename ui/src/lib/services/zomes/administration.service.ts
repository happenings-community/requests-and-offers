import type { ActionHash, Link, Record, AgentPubKey } from '@holochain/client';
import { Context, Effect as E, Layer, pipe } from 'effect';
import { AdministrationError } from '$lib/errors/administration.errors';
import { ADMINISTRATION_CONTEXTS } from '$lib/errors/error-contexts';
import { HolochainClientServiceTag, type HolochainClientService } from '../holochainClient.service';
import {
  AdministrationEntitySchema,
  StatusInDHTSchema,
  RegisterAdministratorInputSchema,
  AddAdministratorInputSchema,
  RemoveAdministratorInputSchema,
  CheckAdministratorInputSchema,
  UpdateEntityStatusInputSchema,
  GetEntityStatusInputSchema,
  BooleanResponseSchema,
  LinkArraySchema,
  RecordArraySchema,
  OptionalRecordSchema,
  type RegisterAdministratorInput,
  type AddAdministratorInput,
  type RemoveAdministratorInput,
  type CheckAdministratorInput,
  type UpdateEntityStatusInput,
  type GetEntityStatusInput
} from '$lib/schemas/administration.schemas';
import { AdministrationEntity, type StatusInDHT } from '$lib/types/holochain';

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
  get_all_revisions: (hash: ActionHash) => E.Effect<Record[], AdministrationError, never>;
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

    const getAllUsersLinks = (): E.Effect<Link[], AdministrationError, never> =>
      pipe(
        hcService.callZomeRawEffect('users_organizations', 'get_all_users', null),
        E.map((result) => result as Link[]),
        E.mapError((error) =>
          AdministrationError.fromError(error, ADMINISTRATION_CONTEXTS.GET_ALL_USERS)
        )
      );

    const getAllOrganizationsLinks = (): E.Effect<Link[], AdministrationError, never> =>
      pipe(
        hcService.callZomeRawEffect('users_organizations', 'get_all_organizations_links', null),
        E.map((result) => result as Link[]),
        E.mapError((error) =>
          AdministrationError.fromError(error, ADMINISTRATION_CONTEXTS.GET_ALL_ORGANIZATIONS)
        )
      );

    const registerAdministrator = (
      input: RegisterAdministratorInput
    ): E.Effect<boolean, AdministrationError, never> =>
      pipe(
        hcService.callZomeEffect(
          'administration',
          'register_administrator',
          input,
          BooleanResponseSchema
        ),
        E.mapError((error) =>
          AdministrationError.fromError(
            error,
            ADMINISTRATION_CONTEXTS.ADD_ADMINISTRATOR,
            input.entity_original_action_hash.toString()
          )
        )
      );

    const addAdministrator = (
      input: AddAdministratorInput
    ): E.Effect<boolean, AdministrationError, never> =>
      pipe(
        hcService.callZomeEffect(
          'administration',
          'add_administrator',
          input,
          BooleanResponseSchema
        ),
        E.mapError((error) =>
          AdministrationError.fromError(
            error,
            ADMINISTRATION_CONTEXTS.ADD_ADMINISTRATOR,
            input.entity_original_action_hash.toString()
          )
        )
      );

    const removeAdministrator = (
      input: RemoveAdministratorInput
    ): E.Effect<boolean, AdministrationError, never> =>
      pipe(
        hcService.callZomeEffect(
          'administration',
          'remove_administrator',
          input,
          BooleanResponseSchema
        ),
        E.mapError((error) =>
          AdministrationError.fromError(
            error,
            ADMINISTRATION_CONTEXTS.REMOVE_ADMINISTRATOR,
            input.entity_original_action_hash.toString()
          )
        )
      );

    const getAllAdministratorsLinks = (
      entity: AdministrationEntity
    ): E.Effect<Link[], AdministrationError, never> =>
      pipe(
        hcService.callZomeRawEffect('administration', 'get_all_administrators_links', entity),
        E.map((result) => result as Link[]),
        E.mapError((error) =>
          AdministrationError.fromError(error, ADMINISTRATION_CONTEXTS.GET_ALL_ADMINISTRATORS)
        )
      );

    const createStatus = (status: StatusInDHT): E.Effect<Record, AdministrationError, never> =>
      pipe(
        hcService.callZomeRawEffect('administration', 'create_status', status),
        E.map((result) => result as Record),
        E.mapError((error) =>
          AdministrationError.fromError(error, ADMINISTRATION_CONTEXTS.CREATE_STATUS)
        )
      );

    const getLatestStatusRecord = (
      original_action_hash: ActionHash
    ): E.Effect<Record | null, AdministrationError, never> =>
      pipe(
        hcService.callZomeRawEffect(
          'administration',
          'get_latest_status_record',
          original_action_hash
        ),
        E.map((result) => result as Record | null),
        E.mapError((error) =>
          AdministrationError.fromError(
            error,
            ADMINISTRATION_CONTEXTS.GET_LATEST_STATUS,
            original_action_hash.toString()
          )
        )
      );

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
      pipe(
        hcService.callZomeEffect(
          'administration',
          'check_if_agent_is_administrator',
          input,
          BooleanResponseSchema
        ),
        E.mapError((error) =>
          AdministrationError.fromError(
            error,
            ADMINISTRATION_CONTEXTS.GET_STATUS_FOR_ENTITY,
            input.agent_pubkey.toString()
          )
        )
      );

    const getAllRevisionsForStatus = (
      status_original_action_hash: ActionHash
    ): E.Effect<Record[], AdministrationError, never> =>
      pipe(
        hcService.callZomeRawEffect(
          'administration',
          'get_all_revisions_for_status',
          status_original_action_hash
        ),
        E.map((result) => result as Record[]),
        E.mapError((error) =>
          AdministrationError.fromError(
            error,
            ADMINISTRATION_CONTEXTS.GET_STATUS_REVISIONS,
            status_original_action_hash.toString()
          )
        )
      );

    const updateEntityStatus = (
      input: UpdateEntityStatusInput
    ): E.Effect<Record, AdministrationError, never> =>
      pipe(
        hcService.callZomeRawEffect('administration', 'update_entity_status', input),
        E.map((result) => result as Record),
        E.mapError((error) =>
          AdministrationError.fromError(
            error,
            input.entity === AdministrationEntity.Users
              ? ADMINISTRATION_CONTEXTS.UPDATE_USER_STATUS
              : ADMINISTRATION_CONTEXTS.UPDATE_ORGANIZATION_STATUS,
            input.entity_original_action_hash.toString()
          )
        )
      );

    const getLatestStatusRecordForEntity = (
      input: GetEntityStatusInput
    ): E.Effect<Record | null, AdministrationError, never> =>
      pipe(
        hcService.callZomeRawEffect('administration', 'get_latest_status_record_for_entity', input),
        E.map((result) => result as Record | null),
        E.mapError((error) =>
          AdministrationError.fromError(
            error,
            ADMINISTRATION_CONTEXTS.GET_STATUS_FOR_ENTITY,
            input.entity_original_action_hash.toString()
          )
        )
      );

    const get_all_revisions = (hash: ActionHash): E.Effect<Record[], AdministrationError, never> =>
      pipe(
        hcService.callZomeRawEffect('administration', 'get_all_revisions', hash),
        E.map((result) => result as Record[]),
        E.mapError((error) =>
          AdministrationError.fromError(
            error,
            ADMINISTRATION_CONTEXTS.GET_STATUS_REVISIONS,
            hash.toString()
          )
        )
      );

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
      getLatestStatusRecordForEntity,
      get_all_revisions
    });
  })
);
