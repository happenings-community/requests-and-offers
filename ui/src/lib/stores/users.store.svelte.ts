import type { ActionHash, AgentPubKey, Link } from '@holochain/client';
import { decodeRecords } from '$lib/utils';
import type { UIUser, UIStatus } from '$lib/types/ui';
import { UsersService } from '$lib/services/zomes/users.service';
import hc from '$lib/services/HolochainClientService.svelte';
import { AdministrationEntity, type UserInDHT, type UserInput } from '$lib/types/holochain';
import administrationStore from './administration.store.svelte';
import serviceTypesStore from './serviceTypes.store.svelte';
import { runEffect } from '$lib/utils/effect';

export interface IUserStore {
  currentUser: UIUser | null;
  acceptedUsers: UIUser[];
  createUser(input: UserInput): Promise<UIUser>;
  getLatestUser(original_action_hash: ActionHash): Promise<UIUser | null>;
  getUserByActionHash(actionHash: ActionHash): Promise<UIUser | null>;
  setCurrentUser(user: UIUser): Promise<void>;
  refreshCurrentUser(): Promise<UIUser | null>;
  updateCurrentUser(input: UserInput): Promise<UIUser | null>;
  getAcceptedUsers(): Promise<UIUser[]>;
  getUserStatusLink(userHash: ActionHash): Promise<Link | null>;
  getUsersByActionHashes(actionHashes: ActionHash[]): Promise<UIUser[]>;
  refresh(): Promise<void>;
  getUserAgents(actionHash: ActionHash): Promise<AgentPubKey[]>;
  getUserByAgentPubKey(agentPubKey: AgentPubKey): Promise<UIUser | null>;
}

class UsersStore implements IUserStore {
  currentUser: UIUser | null = $state(null);
  acceptedUsers: UIUser[] = $state([]);

  async createUser(input: UserInput): Promise<UIUser> {
    const record = await UsersService.createUser(input);
    const newUser = {
      ...decodeRecords<UserInDHT>([record])[0],
      original_action_hash: record.signed_action.hashed.hash,
      previous_action_hash: record.signed_action.hashed.hash,
      service_type_hashes: input.service_type_hashes
    };

    administrationStore.allUsers = [...administrationStore.allUsers, newUser];
    return newUser;
  }

  async getLatestUser(original_action_hash: ActionHash): Promise<UIUser | null> {
    const record = await UsersService.getLatestUserRecord(original_action_hash);
    if (!record) return null;

    // Fetch service types for this user
    let serviceTypeHashes: ActionHash[] = [];
    try {
      serviceTypeHashes = await runEffect(
        serviceTypesStore.getServiceTypesForEntity({
          original_action_hash,
          entity: 'user'
        })
      );
    } catch (error) {
      console.warn('Failed to get service type hashes for user:', error);
      serviceTypeHashes = [];
    }

    return {
      ...decodeRecords<UserInDHT>([record])[0],
      original_action_hash: original_action_hash,
      previous_action_hash: record.signed_action.hashed.hash,
      service_type_hashes: serviceTypeHashes
    };
  }

  async getUserByActionHash(actionHash: ActionHash): Promise<UIUser | null> {
    // First try to get from memory
    const cachedUser = administrationStore.allUsers.find(
      (user) => user.original_action_hash?.toString() === actionHash.toString()
    );
    if (cachedUser) return cachedUser;

    // If not in memory, fetch from DHT
    const user = await this.getLatestUser(actionHash);
    if (!user) return null;

    // Add to allUsers cache
    administrationStore.allUsers = [...administrationStore.allUsers, user];
    return user;
  }

  async setCurrentUser(user: UIUser) {
    this.currentUser = user;
  }

  async refreshCurrentUser(): Promise<UIUser | null> {
    const agentPubKey = (await hc.getAppInfo())?.agent_pub_key;
    if (!agentPubKey) return null;

    const links = await UsersService.getAgentUser(agentPubKey);
    if (links.length === 0) return null;

    const userRecord = await UsersService.getLatestUserRecord(links[0].target);
    if (!userRecord) return null;

    const statusLink = await this.getUserStatusLink(links[0].target);
    if (!statusLink) return null;

    const statusRecord = await administrationStore.getLatestStatusRecordForEntity(
      links[0].target,
      AdministrationEntity.Users
    );
    if (!statusRecord) return null;

    // Fetch service types for current user
    let serviceTypeHashes: ActionHash[] = [];
    try {
      serviceTypeHashes = await runEffect(
        serviceTypesStore.getServiceTypesForEntity({
          original_action_hash: links[0].target,
          entity: 'user'
        })
      );
    } catch (error) {
      console.warn('Failed to get service type hashes for current user:', error);
      serviceTypeHashes = [];
    }

    this.currentUser = {
      ...decodeRecords<UserInDHT>([userRecord])[0],
      status: {
        ...decodeRecords<UIStatus>([statusRecord])[0],
        original_action_hash: statusLink.target,
        previous_action_hash: statusRecord.signed_action.hashed.hash
      },
      original_action_hash: links[0].target,
      previous_action_hash: userRecord.signed_action.hashed.hash,
      service_type_hashes: serviceTypeHashes
    };

    administrationStore.allUsers = administrationStore.allUsers.map((u) =>
      u.original_action_hash?.toString() === this.currentUser?.original_action_hash?.toString()
        ? this.currentUser!
        : u
    );

    return this.currentUser;
  }

  async updateCurrentUser(input: UserInput): Promise<UIUser | null> {
    const userOriginalActionHash = this.currentUser?.original_action_hash;
    const userPreviousActionHash = this.currentUser?.previous_action_hash;

    if (!userOriginalActionHash || !userPreviousActionHash) return null;

    const record = await UsersService.updateUser(
      userOriginalActionHash,
      userPreviousActionHash,
      input.user,
      input.service_type_hashes
    );

    // Fetch updated service types
    let serviceTypeHashes: ActionHash[] = [];
    try {
      serviceTypeHashes = await runEffect(
        serviceTypesStore.getServiceTypesForEntity({
          original_action_hash: userOriginalActionHash,
          entity: 'user'
        })
      );
    } catch (error) {
      console.warn('Failed to get service type hashes after user update:', error);
      serviceTypeHashes = input.service_type_hashes || [];
    }

    const updatedUser: UIUser = {
      ...decodeRecords<UserInDHT>([record])[0],
      status: this.currentUser?.status,
      original_action_hash: userOriginalActionHash,
      previous_action_hash: record.signed_action.hashed.hash,
      service_type_hashes: serviceTypeHashes
    };

    this.setCurrentUser(updatedUser);

    administrationStore.allUsers = administrationStore.allUsers.map((u) =>
      u.original_action_hash?.toString() === this.currentUser?.original_action_hash?.toString()
        ? this.currentUser!
        : u
    );

    return updatedUser;
  }

  async getAcceptedUsers(): Promise<UIUser[]> {
    const links = await UsersService.getAcceptedUsersLinks();

    const users: UIUser[] = [];

    for (const link of links) {
      const user = await this.getLatestUser(link.target);
      if (user?.original_action_hash) {
        const status = await administrationStore.getLatestStatusForEntity(
          user.original_action_hash,
          AdministrationEntity.Users
        );
        if (!status) continue;

        user.status = status;
        users.push(user);
      }
    }

    this.acceptedUsers = users;

    return users;
  }

  async getUserStatusLink(userHash: ActionHash) {
    return await UsersService.getUserStatusLink(userHash);
  }

  // Helper methods
  async getUsersByActionHashes(actionHashes: ActionHash[]): Promise<UIUser[]> {
    const users = await Promise.all(
      actionHashes.map(async (hash) => {
        // First try to get from memory
        const cachedUser = administrationStore.allUsers.find(
          (user) => user.original_action_hash?.toString() === hash.toString()
        );
        if (cachedUser) return cachedUser;

        // If not in memory, fetch from DHT
        const user = await this.getLatestUser(hash);
        if (!user) return null;

        // Add to allUsers cache
        administrationStore.allUsers = [...administrationStore.allUsers, user];
        return user;
      })
    );

    return users.filter((user): user is UIUser => user !== null);
  }

  async refresh(): Promise<void> {
    await this.refreshCurrentUser();
    await this.getAcceptedUsers();
  }

  async getUserAgents(actionHash: ActionHash): Promise<AgentPubKey[]> {
    return UsersService.getUserAgents(actionHash);
  }

  // Get user profile by agent public key
  async getUserByAgentPubKey(agentPubKey: AgentPubKey): Promise<UIUser | null> {
    try {
      const links = await UsersService.getAgentUser(agentPubKey);
      if (links.length === 0) return null;

      const userActionHash = links[0].target;

      const cachedUser = administrationStore.allUsers.find(
        (user) => user.original_action_hash?.toString() === userActionHash.toString()
      );
      if (cachedUser) return cachedUser;

      return this.getLatestUser(userActionHash);
    } catch (error) {
      console.error('Error getting user by agent pub key:', error);
      return null;
    }
  }
}

const usersStore = new UsersStore();
export default usersStore;
