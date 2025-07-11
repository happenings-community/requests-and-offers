import type { ActionHash, AgentPubKey, Record } from '@holochain/client';
import { decodeRecords } from '$lib/utils';
import type { UIStatus, Revision, UIUser, UIOrganization } from '$lib/types/ui';
import { AdministrationEntity, type StatusInDHT } from '$lib/types/holochain';
import { AdministrationService } from '$lib/services/zomes/administration.service';
import usersStore from './users.store.svelte';
import organizationsStore from './organizations.store.svelte';
import hc from '$lib/services/HolochainClientService.svelte';
import { OrganizationsService } from '$lib/services/zomes/organizations.service';
import { storeEventBus } from './storeEvents';

class AdministrationStore {
  allUsersStatusesHistory: Revision[] = $state([]);
  allOrganizationsStatusesHistory: Revision[] = $state([]);
  administrators: UIUser[] = $state([]);
  nonAdministrators: UIUser[] = $state([]);
  agentIsAdministrator = $state(false);
  allUsers: UIUser[] = $state([]);
  allOrganizations: UIOrganization[] = $state([]);

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    storeEventBus.on('user:created', ({ user }) => {
      this.allUsers.push(user);
      this.getAllNetworkAdministrators(); // Refresh admin/non-admin lists
    });

    storeEventBus.on('user:updated', ({ user }) => {
      const index = this.allUsers.findIndex(
        (u) => u.original_action_hash?.toString() === user.original_action_hash?.toString()
      );
      if (index !== -1) {
        this.allUsers[index] = user;
      }
      this.getAllNetworkAdministrators(); // Refresh admin/non-admin lists
    });

    storeEventBus.on('user:loaded', ({ user }) => {
      // Add to cache if not already present
      const exists = this.allUsers.some(
        (u) => u.original_action_hash?.toString() === user.original_action_hash?.toString()
      );
      if (!exists) {
        this.allUsers.push(user);
      }
    });

    storeEventBus.on('user:synced', ({ user }) => {
      // Update current user in cache
      const index = this.allUsers.findIndex(
        (u) => u.original_action_hash?.toString() === user.original_action_hash?.toString()
      );
      if (index !== -1) {
        this.allUsers[index] = user;
      } else {
        this.allUsers.push(user);
      }
    });

    // TODO: Add listener for user:deleted
  }

  async initialize() {
    const results = await Promise.allSettled([
      this.fetchAllUsers(),
      this.fetchAllOrganizations(),
      this.getAllRevisionsForAllUsers()
    ]);

    return results.map((result, index) => ({
      operation: ['fetchAllUsers', 'fetchAllOrganizations', 'getAllRevisionsForAllUsers'][index],
      status: result.status,
      value: result.status === 'fulfilled' ? result.value : undefined,
      error: result.status === 'rejected' ? result.reason : undefined
    }));
  }

  async getAllUsers(): Promise<UIUser[]> {
    try {
      const links = await AdministrationService.getAllUsersLinks();
      const users: UIUser[] = [];

      for (const link of links) {
        const user = await usersStore.getLatestUser(link.target);
        if (!user?.original_action_hash) continue;

        const statusLink = await usersStore.getUserStatusLink(user.original_action_hash);
        if (!statusLink) continue;

        const status = await this.getLatestStatusRecordForEntity(
          user.original_action_hash,
          AdministrationEntity.Users
        );
        if (!status) continue;

        user.status = {
          ...decodeRecords<UIStatus>([status])[0],
          original_action_hash: statusLink.target,
          previous_action_hash: status.signed_action.hashed.hash
        };

        console.log('User status:', user.status);
        users.push(user);
      }

      return users;
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw error;
    }
  }

  async fetchAllUsers() {
    try {
      this.allUsers = await this.getAllUsers();
      await this.getAllNetworkAdministrators();
      return this.allUsers;
    } catch (error) {
      console.error('Error in fetchAllUsers:', error);
      throw error;
    }
  }

  async getAllOrganizations(): Promise<UIOrganization[]> {
    try {
      const links = await OrganizationsService.getAllOrganizationsLinks();
      const organizations: UIOrganization[] = [];

      for (const link of links) {
        const organization = await organizationsStore.getLatestOrganization(link.target);
        if (!organization?.original_action_hash) continue;

        const statusLink = await organizationsStore.getOrganizationStatusLink(
          organization.original_action_hash
        );
        if (!statusLink) continue;

        const status = await this.getLatestStatusRecordForEntity(
          organization.original_action_hash,
          AdministrationEntity.Organizations
        );
        if (!status) continue;

        organization.status = {
          ...decodeRecords<UIStatus>([status])[0],
          original_action_hash: statusLink.target,
          previous_action_hash: status.signed_action.hashed.hash
        };

        organizations.push(organization);
      }

      return organizations;
    } catch (error) {
      console.error('Error in getAllOrganizations:', error);
      throw error;
    }
  }

  async fetchAllOrganizations() {
    try {
      this.allOrganizations = await this.getAllOrganizations();
      return this.allOrganizations;
    } catch (error) {
      console.error('Error in fetchAllOrganizations:', error);
      throw error;
    }
  }

  // Network administrator methods
  async registerNetworkAdministrator(
    entity_original_action_hash: ActionHash,
    agent_pubkeys: AgentPubKey[]
  ): Promise<boolean> {
    try {
      const result = await AdministrationService.registerAdministrator(
        AdministrationEntity.Network,
        entity_original_action_hash,
        agent_pubkeys
      );

      if (result) {
        console.log('Successfully registered network administrator');
        await this.getAllNetworkAdministrators();
      } else {
        console.warn('Failed to register network administrator');
      }

      return result;
    } catch (error) {
      console.error('Error in registerNetworkAdministrator:', error);
      throw error;
    }
  }

  async addNetworkAdministrator(
    agent_pubkeys: AgentPubKey[],
    entity_original_action_hash: ActionHash
  ): Promise<boolean> {
    return await AdministrationService.addAdministrator(
      AdministrationEntity.Network,
      entity_original_action_hash,
      agent_pubkeys
    );
  }

  async removeNetworkAdministrator(entity_original_action_hash: ActionHash): Promise<boolean> {
    // Get the user's agent pubkeys
    const userAgents = await usersStore.getUserAgents(entity_original_action_hash);

    if (!userAgents.length) {
      throw new Error('User agents not found');
    }

    const result = await AdministrationService.removeAdministrator(
      AdministrationEntity.Network,
      entity_original_action_hash,
      userAgents
    );

    if (result) {
      // Refresh the administrators list
      await this.getAllNetworkAdministrators();
    }

    return result;
  }

  async isNetworkAdministrator(agent_pubkey: AgentPubKey): Promise<boolean> {
    return (this.agentIsAdministrator =
      await AdministrationService.checkIfAgentIsAdministrator(agent_pubkey));
  }

  async getAllNetworkAdministrators(): Promise<UIUser[]> {
    const adminLinks = await AdministrationService.getAllAdministratorsLinks(
      AdministrationEntity.Network
    );

    await this.checkIfAgentIsAdministrator();

    // If we already have all users loaded and the current agent is an administrator, use the cached users
    let allUsers: UIUser[];
    if (this.agentIsAdministrator && this.allUsers.length > 0) {
      allUsers = this.allUsers;
    } else {
      // Otherwise, get only accepted users
      allUsers = await usersStore.getAcceptedUsers();
    }

    const admins = allUsers.filter((user) =>
      adminLinks.some((link) => link.target.toString() === user.original_action_hash?.toString())
    );

    this.administrators = admins;
    this.nonAdministrators = allUsers.filter(
      (user) =>
        !admins.some(
          (admin) =>
            admin.original_action_hash?.toString() === user.original_action_hash?.toString()
        )
    );

    return admins;
  }

  async checkIfAgentIsAdministrator(): Promise<boolean> {
    const agent_pubkey = (await hc.getAppInfo())!.agent_pub_key;
    const isAdmin = await AdministrationService.checkIfAgentIsAdministrator(agent_pubkey);
    this.agentIsAdministrator = isAdmin;
    return isAdmin;
  }

  async hasExistingAdministrators(): Promise<boolean> {
    try {
      const adminLinks = await AdministrationService.getAllAdministratorsLinks(
        AdministrationEntity.Network
      );
      return adminLinks.length > 0;
    } catch (error) {
      console.error('Error checking for existing administrators:', error);
      throw error;
    }
  }

  // Status management methods
  private convertToUIStatus(status: StatusInDHT, timestamp?: number): UIStatus {
    let duration: number | undefined;

    if (status?.suspended_until) {
      const suspendedUntil = new Date(status.suspended_until).getTime();
      duration = suspendedUntil - (timestamp || Date.now());
    }

    return {
      ...status,
      duration
    };
  }

  async createStatus(status: StatusInDHT): Promise<void> {
    await AdministrationService.createStatus(status);
  }

  async getAllRevisionsForStatus(uiEntity: UIOrganization | UIUser): Promise<Revision[]> {
    if (!uiEntity.status?.original_action_hash)
      throw new Error('No original action hash for status');

    const records = await AdministrationService.getAllRevisionsForStatus(
      uiEntity.status.original_action_hash
    );

    const revisions: Revision[] = [];

    for (const record of records) {
      const status = decodeRecords([record])[0] as StatusInDHT;
      const timestamp = Math.floor(record.signed_action.hashed.content.timestamp / 1_000);
      const revision: Revision = {
        entity: uiEntity,
        status,
        timestamp
      };
      revisions.push(revision);
    }

    return revisions;
  }

  async getLatestStatusForEntity(
    entity_original_action_hash: ActionHash,
    entity_type: AdministrationEntity
  ): Promise<UIStatus | null> {
    let statusLink;

    if (entity_type === AdministrationEntity.Users) {
      statusLink = await usersStore.getUserStatusLink(entity_original_action_hash);
    } else if (entity_type === AdministrationEntity.Organizations) {
      statusLink = await organizationsStore.getOrganizationStatusLink(entity_original_action_hash);
    }

    if (!statusLink) return null;

    const latestStatus = await AdministrationService.getLatestStatusRecord(statusLink.target);
    if (!latestStatus) return null;

    const status = this.convertToUIStatus(decodeRecords<StatusInDHT>([latestStatus])[0]);
    status.original_action_hash = statusLink.target;
    status.previous_action_hash = latestStatus.signed_action.hashed.hash;

    return status;
  }

  async getLatestStatusRecordForEntity(
    entity_original_action_hash: ActionHash,
    entity_type: AdministrationEntity
  ): Promise<Record | null> {
    const record = await AdministrationService.getLatestStatusRecordForEntity(
      entity_original_action_hash,
      entity_type
    );
    return record;
  }

  async getAllRevisionsForAllUsers(): Promise<Revision[]> {
    const allUsers = await this.getAllUsers();
    const revisions: Revision[] = [];

    for (const user of allUsers) {
      if (!user.original_action_hash || !user.status?.original_action_hash) continue;

      const userRevisions = await this.getAllRevisionsForStatus(user);

      revisions.push(...userRevisions);
    }

    revisions.sort((a, b) => b.timestamp - a.timestamp);
    this.allUsersStatusesHistory = revisions;
    return revisions;
  }

  async getAllRevisionsForAllOrganizations(): Promise<Revision[]> {
    const revisions: Revision[] = [];

    for (const organization of this.allOrganizations) {
      if (!organization.original_action_hash || !organization.status?.original_action_hash)
        continue;

      const organizationRevisions = await this.getAllRevisionsForStatus(organization);
      revisions.push(...organizationRevisions);
    }

    revisions.sort((a, b) => b.timestamp - a.timestamp);
    this.allOrganizationsStatusesHistory = revisions;
    return revisions;
  }

  // Organization status management methods
  async updateOrganizationStatus(
    entity_original_action_hash: ActionHash,
    status_original_action_hash: ActionHash,
    status_previous_action_hash: ActionHash,
    new_status: StatusInDHT
  ): Promise<Record> {
    const record = await AdministrationService.updateEntityStatus(
      AdministrationEntity.Organizations,
      entity_original_action_hash,
      status_original_action_hash,
      status_previous_action_hash,
      new_status
    );

    const status = {
      ...decodeRecords<StatusInDHT>([record])[0],
      original_action_hash: status_original_action_hash,
      previous_action_hash: record.signed_action.hashed.hash
    };

    if (record) {
      // Update the specific organization's status in the store
      this.allOrganizations = this.allOrganizations.map((org) => {
        if (org.original_action_hash?.toString() === entity_original_action_hash.toString()) {
          return {
            ...org,
            status
          };
        }
        return org;
      });
    }

    return record;
  }

  async suspendOrganizationIndefinitely(
    entity_original_action_hash: ActionHash,
    status_original_action_hash: ActionHash,
    status_previous_action_hash: ActionHash,
    reason: string
  ): Promise<Record> {
    return await this.updateOrganizationStatus(
      entity_original_action_hash,
      status_original_action_hash,
      status_previous_action_hash,
      {
        status_type: 'suspended indefinitely',
        reason
      }
    );
  }

  async suspendOrganizationTemporarily(
    entity_original_action_hash: ActionHash,
    status_original_action_hash: ActionHash,
    status_previous_action_hash: ActionHash,
    reason: string,
    duration_in_days: number
  ): Promise<Record> {
    const suspended_until = Date.now() + duration_in_days * 24 * 60 * 60 * 1000;
    return await this.updateOrganizationStatus(
      entity_original_action_hash,
      status_original_action_hash,
      status_previous_action_hash,
      {
        status_type: 'suspended temporarily',
        reason,
        suspended_until: suspended_until.toString()
      }
    );
  }

  // User status management methods
  async updateUserStatus(
    entity_original_action_hash: ActionHash,
    status_original_action_hash: ActionHash,
    status_previous_action_hash: ActionHash,
    new_status: StatusInDHT
  ): Promise<Record> {
    try {
      const record = await AdministrationService.updateEntityStatus(
        AdministrationEntity.Users,
        entity_original_action_hash,
        status_original_action_hash,
        status_previous_action_hash,
        new_status
      );

      const status = {
        ...decodeRecords<StatusInDHT>([record])[0],
        original_action_hash: status_original_action_hash,
        previous_action_hash: record.signed_action.hashed.hash
      };

      console.log('Updating user status:', status);

      if (record) {
        // Update the specific user's status in the store
        this.allUsers = this.allUsers.map((user) => {
          if (user.original_action_hash?.toString() === entity_original_action_hash.toString()) {
            return {
              ...user,
              status
            };
          }
          return user;
        });

        // Also update administrators list if the user is an administrator
        if (
          this.administrators.some(
            (admin) =>
              admin.original_action_hash?.toString() === entity_original_action_hash.toString()
          )
        ) {
          this.administrators = this.administrators.map((admin) => {
            if (admin.original_action_hash?.toString() === entity_original_action_hash.toString()) {
              return {
                ...admin,
                status
              };
            }
            return admin;
          });
        }

        // Update currentUser in usersStore if this is the current user
        if (
          usersStore.currentUser?.original_action_hash?.toString() ===
          entity_original_action_hash.toString()
        ) {
          usersStore.currentUser = {
            ...usersStore.currentUser,
            status
          };
        }
      }

      return record;
    } catch (error) {
      console.error('Error in updateUserStatus:', error);
      throw error;
    }
  }

  async suspendUserIndefinitely(
    entity_original_action_hash: ActionHash,
    status_original_action_hash: ActionHash,
    status_previous_action_hash: ActionHash,
    reason: string
  ): Promise<Record> {
    return await this.updateUserStatus(
      entity_original_action_hash,
      status_original_action_hash,
      status_previous_action_hash,
      {
        status_type: 'suspended indefinitely',
        reason
      }
    );
  }

  async suspendUserTemporarily(
    entity_original_action_hash: ActionHash,
    status_original_action_hash: ActionHash,
    status_previous_action_hash: ActionHash,
    reason: string,
    duration_in_days: number
  ): Promise<Record> {
    const suspended_until = Date.now() + duration_in_days * 24 * 60 * 60 * 1000;
    return await this.updateUserStatus(
      entity_original_action_hash,
      status_original_action_hash,
      status_previous_action_hash,
      {
        status_type: 'suspended temporarily',
        reason,
        suspended_until: suspended_until.toString()
      }
    );
  }

  async approveUser(user: UIUser): Promise<Record> {
    if (
      !user.original_action_hash ||
      !user.status?.original_action_hash ||
      !user.status?.previous_action_hash
    ) {
      throw new Error('User data is incomplete for status change.');
    }
    return this.updateUserStatus(
      user.original_action_hash,
      user.status.original_action_hash,
      user.status.previous_action_hash,
      { status_type: 'accepted' }
    );
  }

  async rejectUser(user: UIUser): Promise<Record> {
    if (
      !user.original_action_hash ||
      !user.status?.original_action_hash ||
      !user.status?.previous_action_hash
    ) {
      throw new Error('User data is incomplete for status change.');
    }
    return this.updateUserStatus(
      user.original_action_hash,
      user.status.original_action_hash,
      user.status.previous_action_hash,
      { status_type: 'rejected' }
    );
  }

  async approveOrganization(organization: UIOrganization): Promise<Record> {
    if (
      !organization.original_action_hash ||
      !organization.status?.original_action_hash ||
      !organization.status?.previous_action_hash
    ) {
      throw new Error('Organization data is incomplete for status change.');
    }
    return this.updateOrganizationStatus(
      organization.original_action_hash,
      organization.status.original_action_hash,
      organization.status.previous_action_hash,
      { status_type: 'accepted' }
    );
  }

  async rejectOrganization(organization: UIOrganization): Promise<Record> {
    if (
      !organization.original_action_hash ||
      !organization.status?.original_action_hash ||
      !organization.status?.previous_action_hash
    ) {
      throw new Error('Organization data is incomplete for status change.');
    }
    return this.updateOrganizationStatus(
      organization.original_action_hash,
      organization.status.original_action_hash,
      organization.status.previous_action_hash,
      { status_type: 'rejected' }
    );
  }

  async unsuspendUser(
    entity_original_action_hash: ActionHash,
    status_original_action_hash: ActionHash,
    status_previous_action_hash: ActionHash
  ): Promise<Record> {
    return await this.updateUserStatus(
      entity_original_action_hash,
      status_original_action_hash,
      status_previous_action_hash,
      {
        status_type: 'accepted'
      }
    );
  }

  getRemainingSuspensionTime(status: UIStatus): number | null {
    if (!status.suspended_until) return null;
    const remaining = Number(status.suspended_until) - Date.now();
    return remaining > 0 ? remaining : null;
  }

  // Helper methods
  async refreshAll() {
    await this.initialize();
  }

  async refreshUsers() {
    await this.fetchAllUsers();
    await this.getAllRevisionsForAllUsers();
  }

  async refreshOrganizations() {
    await this.fetchAllOrganizations();
    await this.getAllRevisionsForAllOrganizations();
  }
}

const administrationStore = new AdministrationStore();
export default administrationStore;
