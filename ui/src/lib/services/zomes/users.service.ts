import type { ActionHash, AgentPubKey, Link, Record } from '@holochain/client';
import type { UserInDHT, UserInput } from '$lib/types/holochain';
import { AdministrationEntity } from '$lib/types/holochain';
import hc from '../HolochainClientService.svelte';

export class UsersService {
  static async createUser(input: UserInput): Promise<Record> {
    return (await hc.callZome('users_organizations', 'create_user', input)) as Record;
  }

  static async getLatestUserRecord(original_action_hash: ActionHash): Promise<Record | null> {
    return (await hc.callZome(
      'users_organizations',
      'get_latest_user_record',
      original_action_hash
    )) as Record | null;
  }

  static async getUserStatusLink(user_original_action_hash: ActionHash): Promise<Link | null> {
    return (await hc.callZome(
      'users_organizations',
      'get_user_status_link',
      user_original_action_hash
    )) as Link | null;
  }

  static async getUserAgents(user_original_action_hash: ActionHash): Promise<AgentPubKey[]> {
    return (await hc.callZome(
      'users_organizations',
      'get_user_agents',
      user_original_action_hash
    )) as AgentPubKey[];
  }

  static async updateUser(
    original_action_hash: ActionHash,
    previous_action_hash: ActionHash,
    updated_user: UserInDHT,
    service_type_hashes: ActionHash[]
  ): Promise<Record> {
    return (await hc.callZome('users_organizations', 'update_user', {
      original_action_hash,
      previous_action_hash,
      updated_user,
      service_type_hashes
    })) as Record;
  }

  static async getAcceptedUsersLinks(): Promise<Link[]> {
    return (await hc.callZome(
      'administration',
      'get_accepted_entities',
      AdministrationEntity.Users
    )) as Link[];
  }

  static async getAgentUser(agent: AgentPubKey): Promise<Link[]> {
    return (await hc.callZome('users_organizations', 'get_agent_user', agent)) as Link[];
  }
}
