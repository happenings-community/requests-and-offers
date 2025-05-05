import type { ActionHash, Link, Record, AgentPubKey } from '@holochain/client';
import type { StatusInDHT } from '@lib/types/holochain';
import { AdministrationEntity } from '@lib/types/holochain';
import hc from '../HolochainClientService.svelte';

export class AdministrationService {
  static async getAllUsersLinks(): Promise<Link[]> {
    return (await hc.callZome('users_organizations', 'get_all_users', null)) as Link[];
  }

  static async registerAdministrator(
    entity: AdministrationEntity,
    entity_original_action_hash: ActionHash,
    agent_pubkeys: AgentPubKey[]
  ): Promise<boolean> {
    try {
      console.log('Registering administrator with:', {
        entity,
        entity_original_action_hash,
        agent_pubkeys
      });

      const result = await hc.callZome('administration', 'register_administrator', {
        entity,
        entity_original_action_hash,
        agent_pubkeys
      });

      console.log('Register administrator result:', result);
      return result as boolean;
    } catch (error) {
      console.error('Error registering administrator:', error);
      throw error;
    }
  }

  static async addAdministrator(
    entity: AdministrationEntity,
    entity_original_action_hash: ActionHash,
    agent_pubkeys: AgentPubKey[]
  ): Promise<boolean> {
    return (await hc.callZome('administration', 'add_administrator', {
      entity,
      entity_original_action_hash,
      agent_pubkeys
    })) as boolean;
  }

  static async removeAdministrator(entity: string, agent_pubkey: AgentPubKey): Promise<boolean> {
    return (await hc.callZome('administration', 'remove_administrator', {
      entity,
      agent_pubkey
    })) as boolean;
  }

  static async getAllAdministratorsLinks(entity: AdministrationEntity): Promise<Link[]> {
    return (await hc.callZome('administration', 'get_all_administrators_links', entity)) as Link[];
  }

  static async createStatus(status: StatusInDHT): Promise<Record> {
    return (await hc.callZome('administration', 'create_status', status)) as Record;
  }

  static async getLatestStatusRecord(original_action_hash: ActionHash): Promise<Record | null> {
    return (await hc.callZome(
      'administration',
      'get_latest_status_record',
      original_action_hash
    )) as Record | null;
  }

  static async registerNetworkAdministrator(
    entity_original_action_hash: ActionHash,
    agent_pubkeys: AgentPubKey[]
  ): Promise<boolean> {
    return await this.registerAdministrator(
      AdministrationEntity.Network,
      entity_original_action_hash,
      agent_pubkeys
    );
  }

  static async checkIfAgentIsAdministrator(agent_pubkey: AgentPubKey): Promise<boolean> {
    return (await hc.callZome('administration', 'check_if_agent_is_administrator', {
      entity: AdministrationEntity.Network,
      agent_pubkey
    })) as boolean;
  }

  static async getAllRevisionsForStatus(
    status_original_action_hash: ActionHash
  ): Promise<Record[]> {
    return (await hc.callZome(
      'administration',
      'get_all_revisions_for_status',
      status_original_action_hash
    )) as Record[];
  }

  static async updateEntityStatus(
    entity_type: AdministrationEntity,
    entity_original_action_hash: ActionHash,
    status_original_action_hash: ActionHash,
    status_previous_action_hash: ActionHash,
    new_status: StatusInDHT
  ): Promise<Record> {
    return (await hc.callZome('administration', 'update_entity_status', {
      entity: entity_type,
      entity_original_action_hash,
      status_original_action_hash,
      status_previous_action_hash,
      new_status
    })) as Record;
  }

  static async getLatestStatusRecordForEntity(
    entity_original_action_hash: ActionHash,
    entity_type: AdministrationEntity
  ): Promise<Record | null> {
    return (await hc.callZome('administration', 'get_latest_status_record_for_entity', {
      entity: entity_type,
      entity_original_action_hash
    })) as Record | null;
  }
}
