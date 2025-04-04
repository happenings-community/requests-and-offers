import type { ActionHash, AgentPubKey } from '@holochain/client';
import { decodeRecords } from '@lib/utils';
import type { UIUser, UIStatus } from '@lib/types/ui';
import { UsersService } from '@services/zomes/users.service';
import hc from '@services/HolochainClientService.svelte';
import { AdministrationEntity, type UserInDHT } from '@lib/types/holochain';
import administrationStore from './administration.store.svelte';

class UsersStore {
  currentUser: UIUser | null = $state(null);
  acceptedUsers: UIUser[] = $state([]);

  async createUser(user: UserInDHT): Promise<UIUser> {
    const record = await UsersService.createUser(user);
    const newUser = {
      ...decodeRecords<UserInDHT>([record])[0],
      original_action_hash: record.signed_action.hashed.hash,
      previous_action_hash: record.signed_action.hashed.hash
    };

    administrationStore.allUsers = [...administrationStore.allUsers, newUser];
    return newUser;
  }

  async getLatestUser(original_action_hash: ActionHash): Promise<UIUser | null> {
    const record = await UsersService.getLatestUserRecord(original_action_hash);
    if (!record) return null;

    return {
      ...decodeRecords<UserInDHT>([record])[0],
      original_action_hash: original_action_hash,
      previous_action_hash: record.signed_action.hashed.hash
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

    this.currentUser = {
      ...decodeRecords<UserInDHT>([userRecord])[0],
      status: {
        ...decodeRecords<UIStatus>([statusRecord])[0],
        original_action_hash: statusLink.target,
        previous_action_hash: statusRecord.signed_action.hashed.hash
      },
      original_action_hash: links[0].target,
      previous_action_hash: userRecord.signed_action.hashed.hash
    };

    administrationStore.allUsers = administrationStore.allUsers.map((u) =>
      u.original_action_hash?.toString() === this.currentUser?.original_action_hash?.toString()
        ? this.currentUser!
        : u
    );

    return this.currentUser;
  }

  async updateCurrentUser(user: UserInDHT): Promise<UIUser | null> {
    const userOriginalActionHash = this.currentUser?.original_action_hash;
    const userPreviousActionHash = this.currentUser?.previous_action_hash;

    if (!userOriginalActionHash || !userPreviousActionHash) return null;

    const record = await UsersService.updateUser(
      userOriginalActionHash,
      userPreviousActionHash,
      user
    );

    const updatedUser: UIUser = {
      ...decodeRecords<UserInDHT>([record])[0],
      status: this.currentUser?.status,
      original_action_hash: userOriginalActionHash,
      previous_action_hash: record.signed_action.hashed.hash
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
