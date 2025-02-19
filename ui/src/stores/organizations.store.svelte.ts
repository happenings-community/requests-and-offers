import type { ActionHash, Link, Record } from '@holochain/client';
import { decodeRecords } from '@utils';
import type { UIOrganization, UIUser, UIStatus } from '@/types/ui';
import type { OrganizationInDHT } from '@/types/holochain';
import { AdministrationEntity } from '@/types/holochain';
import { OrganizationsService } from '@/services/zomes/organizations.service';
import usersStore from './users.store.svelte';
import administrationStore from './administration.store.svelte';

class OrganizationsStore {
  acceptedOrganizations: UIOrganization[] = $state([]);
  currentOrganization: UIOrganization | null = $state(null);
  currentMembers: ActionHash[] = $derived(this.currentOrganization?.members || []);
  currentCoordinators: ActionHash[] = $derived(this.currentOrganization?.coordinators || []);

  async createOrganization(organization: OrganizationInDHT): Promise<Record> {
    const record = await OrganizationsService.createOrganization(organization);
    const newOrganization = {
      ...decodeRecords<OrganizationInDHT>([record])[0],
      original_action_hash: record.signed_action.hashed.hash,
      previous_action_hash: record.signed_action.hashed.hash,
      members: [],
      coordinators: []
    };

    administrationStore.allOrganizations = [
      ...administrationStore.allOrganizations,
      newOrganization
    ];
    return record;
  }

  async getLatestOrganization(original_action_hash: ActionHash): Promise<UIOrganization | null> {
    const record = await OrganizationsService.getLatestOrganizationRecord(original_action_hash);
    if (!record) throw new Error('Organization not found');

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
      throw new Error('Organization status link not found');
    }

    const status = await administrationStore.getLatestStatusRecordForEntity(
      original_action_hash,
      AdministrationEntity.Organizations
    );
    if (!status) {
      throw new Error('Organization status not found');
    }

    organization.status = {
      ...decodeRecords<UIStatus>([status])[0],
      original_action_hash: statusLink.target,
      previous_action_hash: status.signed_action.hashed.hash
    };

    // Update in-memory cache
    administrationStore.allOrganizations = administrationStore.allOrganizations.map((org) =>
      org.original_action_hash?.toString() === original_action_hash.toString() ? organization : org
    );

    if (
      this.currentOrganization?.original_action_hash?.toString() === original_action_hash.toString()
    ) {
      this.currentOrganization = organization;
    }

    return organization;
  }

  async getOrganizationByActionHash(actionHash: ActionHash): Promise<UIOrganization | null> {
    return (
      administrationStore.allOrganizations.find(
        (org) => org.original_action_hash?.toString() === actionHash.toString()
      ) || null
    );
  }

  async refreshOrganization(original_action_hash: ActionHash): Promise<UIOrganization | null> {
    const organization = await this.getLatestOrganization(original_action_hash);
    if (!organization) return null;

    administrationStore.allOrganizations = administrationStore.allOrganizations.map((org) =>
      org.original_action_hash?.toString() === original_action_hash.toString() ? organization : org
    );

    if (
      this.currentOrganization?.original_action_hash?.toString() === original_action_hash.toString()
    ) {
      this.currentOrganization = organization;
    }

    return organization;
  }

  async setCurrentOrganization(organization: UIOrganization) {
    this.currentOrganization = organization;
  }

  async refreshCurrentOrganization(): Promise<UIOrganization | null> {
    if (!this.currentOrganization?.original_action_hash) return null;
    return this.refreshOrganization(this.currentOrganization.original_action_hash);
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
    const organizations = await Promise.all(
      links.map(async (link) => {
        const organization = await this.getLatestOrganization(link.target);
        if (!organization) return null;
        return organization;
      })
    );
    return organizations.filter((org): org is UIOrganization => org !== null);
  }

  async getUserCoordinatedOrganizations(
    userOriginalActionHash: ActionHash
  ): Promise<UIOrganization[]> {
    const links = await OrganizationsService.getUserOrganizationsLinks(userOriginalActionHash);
    const organizations = await Promise.all(
      links.map(async (link) => {
        const isCoordinator = await OrganizationsService.isOrganizationCoordinator(
          link.target,
          userOriginalActionHash
        );

        if (!isCoordinator) return null;

        return this.getLatestOrganization(link.target);
      })
    );

    return organizations.filter((org): org is UIOrganization => org !== null);
  }

  async getUserMemberOnlyOrganizations(
    userOriginalActionHash: ActionHash
  ): Promise<UIOrganization[]> {
    const links = await OrganizationsService.getUserOrganizationsLinks(userOriginalActionHash);
    const organizations = await Promise.all(
      links.map(async (link) => {
        const isCoordinator = await OrganizationsService.isOrganizationCoordinator(
          link.target,
          userOriginalActionHash
        );

        // Only return organizations where the user is a member but not a coordinator
        if (isCoordinator) return null;

        return this.getLatestOrganization(link.target);
      })
    );

    return organizations.filter((org): org is UIOrganization => org !== null);
  }

  async getAcceptedOrganizations(): Promise<UIOrganization[]> {
    const links = await OrganizationsService.getAcceptedOrganizationsLinks();
    const organizations = await Promise.all(
      links.map(async (link) => {
        const organization = await this.getLatestOrganization(link.target);
        return organization;
      })
    );

    this.acceptedOrganizations = organizations.filter((org): org is UIOrganization => org !== null);

    return this.acceptedOrganizations;
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
      const updatedOrg = await this.refreshOrganization(hash);
      if (updatedOrg && this.currentOrganization?.original_action_hash === hash) {
        this.currentOrganization = updatedOrg;
      }

      return updatedOrg;
    }
    return null;
  }

  async deleteOrganization(organization_original_action_hash: ActionHash): Promise<boolean> {
    const success = await OrganizationsService.deleteOrganization(
      organization_original_action_hash
    );
    if (success) {
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
  getOrganizationsByActionHashes(actionHashes: ActionHash[]): UIOrganization[] {
    return administrationStore.allOrganizations.filter((org) =>
      actionHashes.some((hash) => hash.toString() === org.original_action_hash?.toString())
    );
  }

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
