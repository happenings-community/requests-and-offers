import type { ActionHash, Link, Record as HolochainRecord } from '@holochain/client';
import { encodeHashToBase64 } from '@holochain/client';
import { decodeRecords } from '@utils';
import type { UIOrganization, UIUser, UIStatus } from '@lib/types/ui';
import { AdministrationEntity, type OrganizationInDHT } from '@lib/types/holochain';
import { OrganizationsService } from '@services/zomes/organizations.service';
import usersStore from './users.store.svelte';
import administrationStore from './administration.store.svelte';

class OrganizationsStore {
  acceptedOrganizations: UIOrganization[] = $state([]);
  currentOrganization: UIOrganization | null = $state(null);
  currentMembers: ActionHash[] = $derived(this.currentOrganization?.members || []);
  currentCoordinators: ActionHash[] = $derived(this.currentOrganization?.coordinators || []);

  // Cache management
  private cacheTimestamps: { [key: string]: number } = $state({});
  private CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  private pendingRequests: { [key: string]: Promise<UIOrganization | null> } = {};

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

  // Add organization to cache
  private addToCache(organization: UIOrganization): void {
    if (!organization?.original_action_hash) return;

    const hash = encodeHashToBase64(organization.original_action_hash);
    const existingIndex = administrationStore.allOrganizations.findIndex(
      (org) =>
        org.original_action_hash?.toString() === organization.original_action_hash?.toString()
    );

    if (existingIndex >= 0) {
      // Update existing organization
      administrationStore.allOrganizations[existingIndex] = organization;
    } else {
      // Add new organization
      administrationStore.allOrganizations = [
        ...administrationStore.allOrganizations,
        organization
      ];
    }

    this.updateCacheTimestamp(hash);
  }

  async createOrganization(organization: OrganizationInDHT): Promise<HolochainRecord> {
    const record = await OrganizationsService.createOrganization(organization);
    const newOrganization = {
      ...decodeRecords<OrganizationInDHT>([record])[0],
      original_action_hash: record.signed_action.hashed.hash,
      previous_action_hash: record.signed_action.hashed.hash,
      members: [],
      coordinators: []
    };

    this.addToCache(newOrganization);
    return record;
  }

  async getLatestOrganization(original_action_hash: ActionHash): Promise<UIOrganization | null> {
    const hashStr = encodeHashToBase64(original_action_hash);

    // Return from pending request if one exists
    if (this.pendingRequests[hashStr] !== undefined) {
      return this.pendingRequests[hashStr];
    }

    // Create a new request and store it
    this.pendingRequests[hashStr] = (async () => {
      try {
        const record = await OrganizationsService.getLatestOrganizationRecord(original_action_hash);
        if (!record) return null;

        const organization: UIOrganization = {
          ...decodeRecords<OrganizationInDHT>([record])[0],
          original_action_hash,
          previous_action_hash: record.signed_action.hashed.hash,
          members: [],
          coordinators: []
        };

        // Get members and coordinators
        const membersLinks =
          await OrganizationsService.getOrganizationMembersLinks(original_action_hash);
        const coordinatorsLinks =
          await OrganizationsService.getOrganizationCoordinatorsLinks(original_action_hash);

        organization.members = membersLinks.map((link) => link.target);
        organization.coordinators = coordinatorsLinks.map((link) => link.target);

        // Get organization status
        const statusLink = await this.getOrganizationStatusLink(original_action_hash);
        if (!statusLink) {
          console.error('Organization status link not found');
          return null;
        }

        const status = await administrationStore.getLatestStatusRecordForEntity(
          original_action_hash,
          AdministrationEntity.Organizations
        );
        if (!status) {
          console.error('Organization status not found');
          return null;
        }

        organization.status = {
          ...decodeRecords<UIStatus>([status])[0],
          original_action_hash: statusLink.target,
          previous_action_hash: status.signed_action.hashed.hash
        };

        // Update current organization if needed
        if (
          this.currentOrganization?.original_action_hash?.toString() ===
          original_action_hash.toString()
        ) {
          this.currentOrganization = organization;
        }

        this.addToCache(organization);
        return organization;
      } catch (error) {
        console.error('Error fetching organization:', error);
        return null;
      } finally {
        // Clean up pending request
        delete this.pendingRequests[hashStr];
      }
    })();

    return this.pendingRequests[hashStr];
  }

  async getOrganizationByActionHash(actionHash: ActionHash): Promise<UIOrganization | null> {
    const hashStr = encodeHashToBase64(actionHash);

    // First try to get from memory if cache is valid
    const cachedOrg = administrationStore.allOrganizations.find(
      (org) => org.original_action_hash?.toString() === actionHash.toString()
    );

    if (cachedOrg && this.isCacheValid(hashStr)) {
      return cachedOrg;
    }

    // If not in memory or cache expired, fetch from DHT
    return this.getLatestOrganization(actionHash);
  }

  async refreshOrganization(original_action_hash: ActionHash): Promise<UIOrganization | null> {
    // Force refresh by invalidating cache
    const hashStr = encodeHashToBase64(original_action_hash);
    delete this.cacheTimestamps[hashStr];

    return this.getLatestOrganization(original_action_hash);
  }

  async setCurrentOrganization(organization: UIOrganization) {
    this.currentOrganization = organization;
    this.addToCache(organization);
  }

  async refreshCurrentOrganization(): Promise<UIOrganization | null> {
    if (!this.currentOrganization?.original_action_hash) return null;
    return this.refreshOrganization(this.currentOrganization.original_action_hash);
  }

  async getOrganizationsByActionHashes(actionHashes: ActionHash[]): Promise<UIOrganization[]> {
    // First get all cached organizations that are still valid
    const cachedOrgs: UIOrganization[] = [];
    const hashesToFetch: ActionHash[] = [];

    actionHashes.forEach((hash) => {
      const hashStr = encodeHashToBase64(hash);
      const cachedOrg = administrationStore.allOrganizations.find(
        (org) => org.original_action_hash?.toString() === hash.toString()
      );

      if (cachedOrg && this.isCacheValid(hashStr)) {
        cachedOrgs.push(cachedOrg);
      } else {
        hashesToFetch.push(hash);
      }
    });

    // Fetch remaining organizations in parallel
    if (hashesToFetch.length > 0) {
      const fetchedOrgs = await Promise.all(
        hashesToFetch.map((hash) => this.getLatestOrganization(hash))
      );

      return [...cachedOrgs, ...fetchedOrgs.filter((org): org is UIOrganization => org !== null)];
    }

    return cachedOrgs;
  }

  async addMember(
    organization_original_action_hash: ActionHash,
    memberActionHash: ActionHash
  ): Promise<boolean> {
    const success = await OrganizationsService.addOrganizationMember(
      organization_original_action_hash,
      memberActionHash
    );
    console.log('success', success);
    if (success) {
      await this.refreshOrganization(organization_original_action_hash);
      this.currentMembers = this.currentMembers.filter(
        (member) => member.toString() !== memberActionHash.toString()
      );
    }
    return success;
  }

  async removeMember(
    organization_original_action_hash: ActionHash,
    memberActionHash: ActionHash
  ): Promise<boolean> {
    const success = await OrganizationsService.removeOrganizationMember(
      organization_original_action_hash,
      memberActionHash
    );
    if (success) {
      await this.refreshOrganization(organization_original_action_hash);
    }
    return success;
  }

  async addCoordinator(
    organization_original_action_hash: ActionHash,
    coordinatorActionHash: ActionHash
  ): Promise<boolean> {
    const success = await OrganizationsService.addOrganizationCoordinator(
      organization_original_action_hash,
      coordinatorActionHash
    );
    if (success) {
      await this.refreshOrganization(organization_original_action_hash);
    }
    return success;
  }

  async removeCoordinator(
    organization_original_action_hash: ActionHash,
    coordinatorActionHash: ActionHash
  ): Promise<boolean> {
    const success = await OrganizationsService.removeOrganizationCoordinator(
      organization_original_action_hash,
      coordinatorActionHash
    );
    if (success) {
      await this.refreshOrganization(organization_original_action_hash);
    }
    return success;
  }

  async getUserOrganizations(userActionHash: ActionHash): Promise<UIOrganization[]> {
    const links = await OrganizationsService.getUserOrganizationsLinks(userActionHash);
    return this.getOrganizationsByActionHashes(links.map((link) => link.target));
  }

  async getUserCoordinatedOrganizations(
    userOriginalActionHash: ActionHash
  ): Promise<UIOrganization[]> {
    const links = await OrganizationsService.getUserOrganizationsLinks(userOriginalActionHash);
    const organizations = await this.getOrganizationsByActionHashes(
      links.map((link) => link.target)
    );

    // Filter to only include organizations where the user is a coordinator
    const coordinatedOrgs = await Promise.all(
      organizations.map(async (org) => {
        if (!org.original_action_hash) return null;
        const isCoordinator = await OrganizationsService.isOrganizationCoordinator(
          org.original_action_hash,
          userOriginalActionHash
        );
        return isCoordinator ? org : null;
      })
    );

    return coordinatedOrgs.filter((org): org is UIOrganization => org !== null);
  }

  async getUserMemberOnlyOrganizations(
    userOriginalActionHash: ActionHash
  ): Promise<UIOrganization[]> {
    const links = await OrganizationsService.getUserOrganizationsLinks(userOriginalActionHash);
    const organizations = await this.getOrganizationsByActionHashes(
      links.map((link) => link.target)
    );

    // Filter to only include organizations where the user is a member but not a coordinator
    const memberOnlyOrgs = await Promise.all(
      organizations.map(async (org) => {
        if (!org.original_action_hash) return null;
        const isCoordinator = await OrganizationsService.isOrganizationCoordinator(
          org.original_action_hash,
          userOriginalActionHash
        );
        return isCoordinator ? null : org;
      })
    );

    return memberOnlyOrgs.filter((org): org is UIOrganization => org !== null);
  }

  async getAcceptedOrganizations(): Promise<UIOrganization[]> {
    const links = await OrganizationsService.getAcceptedOrganizationsLinks();
    const organizations = await this.getOrganizationsByActionHashes(
      links.map((link) => link.target)
    );

    this.acceptedOrganizations = organizations;
    return organizations;
  }

  async getOrganizationStatusLink(original_action_hash: ActionHash) {
    return await OrganizationsService.getOrganizationStatusLink(original_action_hash);
  }

  async updateOrganization(
    hash: ActionHash,
    updates: Partial<OrganizationInDHT>
  ): Promise<UIOrganization | null> {
    // Get the current organization to merge with updates
    const currentOrg = await OrganizationsService.getLatestOrganizationRecord(hash);
    if (!currentOrg) {
      throw new Error('Organization not found');
    }

    const currentEntry = decodeRecords<OrganizationInDHT>([currentOrg])[0];

    // Create the update input with all required fields
    const input = {
      original_action_hash: hash,
      previous_action_hash: currentOrg.signed_action.hashed.hash,
      updated_organization: {
        name: updates.name ?? currentEntry.name,
        description: updates.description ?? currentEntry.description,
        email: updates.email ?? currentEntry.email,
        location: updates.location ?? currentEntry.location,
        urls: updates.urls ?? currentEntry.urls,
        ...(updates.logo ? { logo: updates.logo } : {})
      }
    };

    const success = await OrganizationsService.updateOrganization(input);
    if (success) {
      // Force refresh by invalidating cache
      const updatedOrg = await this.refreshOrganization(hash);
      return updatedOrg;
    }
    return null;
  }

  async deleteOrganization(organization_original_action_hash: ActionHash): Promise<boolean> {
    const success = await OrganizationsService.deleteOrganization(
      organization_original_action_hash
    );
    if (success) {
      // Remove from cache
      const hashStr = encodeHashToBase64(organization_original_action_hash);
      delete this.cacheTimestamps[hashStr];

      administrationStore.allOrganizations = administrationStore.allOrganizations.filter(
        (org) =>
          org.original_action_hash?.toString() !== organization_original_action_hash.toString()
      );
      if (
        this.currentOrganization?.original_action_hash?.toString() ===
        organization_original_action_hash.toString()
      ) {
        this.currentOrganization = null;
      }
    }
    return success;
  }

  async leaveOrganization(hash: ActionHash): Promise<boolean> {
    const success = await OrganizationsService.leaveOrganization(hash);
    if (success) {
      await this.refresh();
    }
    return success;
  }

  async isOrganizationCoordinator(orgHash: ActionHash, userHash: ActionHash): Promise<boolean> {
    return OrganizationsService.isOrganizationCoordinator(orgHash, userHash);
  }

  async getOrganizationMembers(organizationHash: ActionHash): Promise<Link[]> {
    try {
      return await OrganizationsService.getOrganizationMembersLinks(organizationHash);
    } catch (error) {
      console.error('Failed to get organization members:', error);
      return [];
    }
  }

  async getOrganizationCoordinators(organizationHash: ActionHash): Promise<Link[]> {
    try {
      return await OrganizationsService.getOrganizationCoordinatorsLinks(organizationHash);
    } catch (error) {
      console.error('Failed to get organization coordinators:', error);
      return [];
    }
  }

  // Helper methods
  async getMemberUsers(organization: UIOrganization): Promise<UIUser[]> {
    return usersStore.getUsersByActionHashes(organization.members);
  }

  async getCoordinatorUsers(organization: UIOrganization): Promise<UIUser[]> {
    return usersStore.getUsersByActionHashes(organization.coordinators);
  }

  async refresh(): Promise<void> {
    await this.getAcceptedOrganizations();
    if (this.currentOrganization) {
      await this.refreshCurrentOrganization();
    }
  }
}

const organizationsStore = new OrganizationsStore();
export default organizationsStore;
