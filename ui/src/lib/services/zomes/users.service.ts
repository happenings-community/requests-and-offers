import type { ActionHash, AgentPubKey, Link, Record } from '@holochain/client';
import { Context, Effect as E, Layer } from 'effect';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { UserError } from '$lib/errors/users.errors';
import { USER_CONTEXTS } from '$lib/errors/error-contexts';
import type { UserInDHT } from '$lib/schemas/users.schemas';
import { AdministrationEntity } from '$lib/types/holochain';
import { wrapZomeCallWithErrorFactory } from '$lib/utils/zome-helpers';

// ============================================================================
// SERVICE TAG
// ============================================================================

export interface UsersService {
  readonly createUser: (input: UserInDHT) => E.Effect<Record, UserError>;
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
    updated_user: UserInDHT
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
    E.gen(function* () {
      const holochainClient = yield* HolochainClientServiceTag;

      // Helper to wrap Promise-based methods in Effect
      const wrapZomeCall = <T>(
        zomeName: string,
        fnName: string,
        payload: unknown,
        context: string = USER_CONTEXTS.CREATE_USER
      ): E.Effect<T, UserError> =>
        wrapZomeCallWithErrorFactory(
          holochainClient,
          zomeName,
          fnName,
          payload,
          context,
          UserError.fromError
        );

      const createUser = (input: UserInDHT): E.Effect<Record, UserError> =>
        wrapZomeCall('users_organizations', 'create_user', {
          ...input
        });

      const getLatestUserRecord = (
        original_action_hash: ActionHash
      ): E.Effect<Record | null, UserError> =>
        wrapZomeCall('users_organizations', 'get_latest_user_record', original_action_hash);

      const getUserStatusLink = (
        user_original_action_hash: ActionHash
      ): E.Effect<Link | null, UserError> =>
        wrapZomeCall('users_organizations', 'get_user_status_link', user_original_action_hash);

      const getUserAgents = (
        user_original_action_hash: ActionHash
      ): E.Effect<AgentPubKey[], UserError> =>
        wrapZomeCall('users_organizations', 'get_user_agents', user_original_action_hash);

      const updateUser = (
        original_action_hash: ActionHash,
        previous_action_hash: ActionHash,
        updated_user: UserInDHT
      ): E.Effect<Record, UserError> =>
        wrapZomeCall('users_organizations', 'update_user', {
          original_action_hash,
          previous_action_hash,
          updated_user
        });

      const getAcceptedUsersLinks = (): E.Effect<Link[], UserError> =>
        wrapZomeCall('administration', 'get_accepted_entities', AdministrationEntity.Users);

      const getAgentUser = (agent: AgentPubKey): E.Effect<Link[], UserError> =>
        wrapZomeCall('users_organizations', 'get_agent_user', agent);

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
