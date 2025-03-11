import type { ActionHash, AgentPubKey } from '@holochain/client';
import { encodeHashToBase64 } from '@holochain/client';
import { decodeRecords } from '@utils';
import type { UIUser } from '@/types/ui';
import { UsersService } from '@/services/zomes/users.service';
import hc from '@services/HolochainClientService.svelte';
import type { UserInDHT } from '@/types/holochain';
import administrationStore from './administration.store.svelte';

class UsersStore {
  currentUser: UIUser | null = $state(null);
  acceptedUsers: UIUser[] = $state([]);
  
  // Cache management
  private cacheTimestamps: Record<string, number> = $state({});
  private CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  private pendingRequests: Record<string, Promise<UIUser | null>> = {};

  // Check if cache is valid
  private isCacheValid(hash: string): boolean {
    const timestamp = this.cacheTimestamps[hash];
    if (!timestamp) return false;
    return Date.now() - timestamp < this.CACHE_EXPIRY_MS;
  }

  // Update cache timestamp
  private updateCacheTimestamp(hash: string): void {
    this.cacheTimestamps[hash] = Date.now();
  }

  // Add user to cache
  private addToCache(user: UIUser): void {
    if (!user?.original_action_hash) return;
    
    const hash = encodeHashToBase64(user.original_action_hash);
    const existingIndex = administrationStore.allUsers.findIndex(
      (u) => u.original_action_hash?.toString() === user.original_action_hash?.toString()
    );
    
    if (existingIndex >= 0) {
      // Update existing user
      administrationStore.allUsers[existingIndex] = user;
    } else {
      // Add new user
      administrationStore.allUsers = [...administrationStore.allUsers, user];
    }
    
    this.updateCacheTimestamp(hash);
  }

  async createUser(user: UserInDHT): Promise<UIUser> {
    const record = await UsersService.createUser(user);
    const newUser = {
      ...decodeRecords<UserInDHT>([record])[0],
      original_action_hash: record.signed_action.hashed.hash,
      previous_action_hash: record.signed_action.hashed.hash
    };

    this.addToCache(newUser);
    return newUser;
  }

  async getLatestUser(original_action_hash: ActionHash): Promise<UIUser | null> {
    const hashStr = encodeHashToBase64(original_action_hash);
    
    // Return from pending request if one exists
    if (this.pendingRequests[hashStr] !== undefined) {
      return this.pendingRequests[hashStr];
    }
    
    // Create a new request and store it
    this.pendingRequests[hashStr] = (async () => {
      try {
        const record = await UsersService.getLatestUserRecord(original_action_hash);
        if (!record) return null;

        const user = {
          ...decodeRecords<UserInDHT>([record])[0],
          original_action_hash: original_action_hash,
          previous_action_hash: record.signed_action.hashed.hash
        };

        this.addToCache(user);
        return user;
      } catch (error) {
        console.error('Error fetching user:', error);
        return null;
      } finally {
        // Clean up pending request
        delete this.pendingRequests[hashStr];
      }
    })();
    
    return this.pendingRequests[hashStr];
  }

  async getUserByActionHash(actionHash: ActionHash): Promise<UIUser | null> {
    const hashStr = encodeHashToBase64(actionHash);
    
    // First try to get from memory if cache is valid
    const cachedUser = administrationStore.allUsers.find(
      (user) => user.original_action_hash?.toString() === actionHash.toString()
    );
    
    if (cachedUser && this.isCacheValid(hashStr)) {
      return cachedUser;
    }

    // If not in memory or cache expired, fetch from DHT
    return this.getLatestUser(actionHash);
  }

  async setCurrentUser(user: UIUser) {
    this.currentUser = user;
    this.addToCache(user);
  }

  async refreshCurrentUser(): Promise<UIUser | null> {
    const agentPubKey = (await hc.getAppInfo())?.agent_pub_key;
    if (!agentPubKey) return null;

    const links = await UsersService.getAgentUser(agentPubKey);
    if (links.length === 0) return null;

    // Force refresh by invalidating cache
    const userActionHash = links[0].target;
    const hashStr = encodeHashToBase64(userActionHash);
    delete this.cacheTimestamps[hashStr];

    // Get fresh user data
    const user = await this.getLatestUser(userActionHash);
    if (!user) return null;

    this.currentUser = user;
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

    // Update cache and current user
    this.setCurrentUser(updatedUser);
    
    // Force refresh to get latest status
    await this.refreshCurrentUser();
    
    return this.currentUser;
  }

  async getAcceptedUsers(): Promise<UIUser[]> {
    const links = await UsersService.getAcceptedUsersLinks();
    
    // Get all users with caching
    const users = await this.getUsersByActionHashes(links.map(link => link.target));
    
    // Filter to ensure all have status
    const acceptedUsers = users.filter(user => user.status?.status_type === 'accepted');
    
    this.acceptedUsers = acceptedUsers;
    return acceptedUsers;
  }

  async getUserStatusLink(userHash: ActionHash) {
    return await UsersService.getUserStatusLink(userHash);
  }

  async getUsersByActionHashes(actionHashes: ActionHash[]): Promise<UIUser[]> {
    // First get all cached users that are still valid
    const cachedUsers: UIUser[] = [];
    const hashesToFetch: ActionHash[] = [];
    
    actionHashes.forEach(hash => {
      const hashStr = encodeHashToBase64(hash);
      const cachedUser = administrationStore.allUsers.find(
        (user) => user.original_action_hash?.toString() === hash.toString()
      );
      
      if (cachedUser && this.isCacheValid(hashStr)) {
        cachedUsers.push(cachedUser);
      } else {
        hashesToFetch.push(hash);
      }
    });
    
    // Fetch remaining users in parallel
    if (hashesToFetch.length > 0) {
      const fetchedUsers = await Promise.all(
        hashesToFetch.map(hash => this.getLatestUser(hash))
      );
      
      return [
        ...cachedUsers,
        ...fetchedUsers.filter((user): user is UIUser => user !== null)
      ];
    }
    
    return cachedUsers;
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
      return this.getUserByActionHash(userActionHash);
    } catch (error) {
      console.error('Error getting user by agent pub key:', error);
      return null;
    }
  }
}

const usersStore = new UsersStore();
export default usersStore;
