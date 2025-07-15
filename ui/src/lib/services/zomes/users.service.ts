import type { ActionHash, AgentPubKey, Link, Record } from '@holochain/client';
import { Context, Effect as E, Layer, pipe } from 'effect';
import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { UserError } from '$lib/errors/users.errors';
import { USER_CONTEXTS } from '$lib/errors/error-contexts';
import type { UserInDHT, UserInput } from '$lib/schemas/users.schemas';
import { AdministrationEntity } from '$lib/types/holochain';

// ============================================================================
// SERVICE TAG
// ============================================================================

export interface UsersService {
  readonly createUser: (input: UserInput) => E.Effect<Record, UserError>;
  readonly getLatestUserRecord: (
    original_action_hash: ActionHash
  ) => E.Effect<Record | null, UserError>;
  readonly getUserStatusLink: (
    user_original_action_hash: ActionHash
  ) => E.Effect<Link | null, UserError>;
  readonly getUserAgents: (
    user_original_action_hash: ActionHash
  ) => E.Effect<AgentPubKey[], UserError>;
  readonly updateUser: (
    original_action_hash: ActionHash,
    previous_action_hash: ActionHash,
    updated_user: UserInDHT,
    service_type_hashes: ActionHash[]
  ) => E.Effect<Record, UserError>;
  readonly getAcceptedUsersLinks: () => E.Effect<Link[], UserError>;
  readonly getAgentUser: (agent: AgentPubKey) => E.Effect<Link[], UserError>;
}

export class UsersServiceTag extends Context.Tag('UsersService')<UsersServiceTag, UsersService>() {}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export const UsersServiceLive: Layer.Layer<UsersServiceTag, never, HolochainClientServiceTag> =
  Layer.effect(
    UsersServiceTag,
    E.gen(function* ($) {
      const holochainClient = yield* $(HolochainClientServiceTag);

      const createUser = (input: UserInput): E.Effect<Record, UserError> =>
        pipe(
          holochainClient.callZomeRawEffect('users_organizations', 'create_user', {
            user: { ...input.user },
            service_type_hashes: [...(input.service_type_hashes || [])]
          }),
          E.map((result) => result as Record),
          E.mapError((error) => UserError.fromError(error, USER_CONTEXTS.CREATE_USER))
        );

      const getLatestUserRecord = (
        original_action_hash: ActionHash
      ): E.Effect<Record | null, UserError> =>
        pipe(
          holochainClient.callZomeRawEffect(
            'users_organizations',
            'get_latest_user_record',
            original_action_hash
          ),
          E.map((result) => result as Record | null),
          E.mapError((error) =>
            UserError.fromError(error, USER_CONTEXTS.GET_USER, original_action_hash.toString())
          )
        );

      const getUserStatusLink = (
        user_original_action_hash: ActionHash
      ): E.Effect<Link | null, UserError> =>
        pipe(
          holochainClient.callZomeRawEffect(
            'users_organizations',
            'get_user_status_link',
            user_original_action_hash
          ),
          E.map((result) => result as Link | null),
          E.mapError((error) =>
            UserError.fromError(
              error,
              USER_CONTEXTS.GET_USER_STATUS,
              user_original_action_hash.toString()
            )
          )
        );

      const getUserAgents = (
        user_original_action_hash: ActionHash
      ): E.Effect<AgentPubKey[], UserError> =>
        pipe(
          holochainClient.callZomeRawEffect(
            'users_organizations',
            'get_user_agents',
            user_original_action_hash
          ),
          E.map((result) => result as AgentPubKey[]),
          E.mapError((error) =>
            UserError.fromError(
              error,
              USER_CONTEXTS.GET_USER_AGENTS,
              user_original_action_hash.toString()
            )
          )
        );

      const updateUser = (
        original_action_hash: ActionHash,
        previous_action_hash: ActionHash,
        updated_user: UserInDHT,
        service_type_hashes: ActionHash[]
      ): E.Effect<Record, UserError> =>
        pipe(
          holochainClient.callZomeRawEffect('users_organizations', 'update_user', {
            original_action_hash,
            previous_action_hash,
            updated_user,
            service_type_hashes
          }),
          E.map((result) => result as Record),
          E.mapError((error) =>
            UserError.fromError(error, USER_CONTEXTS.UPDATE_USER, original_action_hash.toString())
          )
        );

      const getAcceptedUsersLinks = (): E.Effect<Link[], UserError> =>
        pipe(
          holochainClient.callZomeRawEffect(
            'administration',
            'get_accepted_entities',
            AdministrationEntity.Users
          ),
          E.map((result) => result as Link[]),
          E.mapError((error) => UserError.fromError(error, USER_CONTEXTS.GET_ACCEPTED_USERS))
        );

      const getAgentUser = (agent: AgentPubKey): E.Effect<Link[], UserError> =>
        pipe(
          holochainClient.callZomeRawEffect('users_organizations', 'get_agent_user', agent),
          E.map((result) => result as Link[]),
          E.mapError((error) => UserError.fromError(error, USER_CONTEXTS.GET_AGENT_USER))
        );

      return UsersServiceTag.of({
        createUser,
        getLatestUserRecord,
        getUserStatusLink,
        getUserAgents,
        updateUser,
        getAcceptedUsersLinks,
        getAgentUser
      });
    })
  );

// ============================================================================
// TYPE EXPORTS FOR BACKWARD COMPATIBILITY
// ============================================================================
// These will be removed after full refactoring is complete
