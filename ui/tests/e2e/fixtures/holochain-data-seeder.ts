import type { AppWebsocket, ActionHash, Record } from '@holochain/client';
import { RealisticDataGenerator, type User, type Organization, type ServiceType, type MediumOfExchange, type Request, type Offer } from './realistic-data-generator';

// ============================================================================
// HOLOCHAIN DATA SEEDING SERVICE
// ============================================================================

export class HolochainDataSeeder {
  constructor(private client: AppWebsocket) {}

  // ========================================================================
  // CORE SEEDING METHODS
  // ========================================================================

  /**
   * Seeds the Holochain DNA with a complete realistic dataset
   */
  async seedCompleteDataset(): Promise<SeededData> {
    console.log('🌱 Starting complete dataset seeding...');
    
    // Generate the base dataset
    const dataset = RealisticDataGenerator.generateCompleteDataset();
    
    // Seed in dependency order
    const seededData: SeededData = {
      users: [],
      organizations: [],
      serviceTypes: [],
      mediumsOfExchange: [],
      requests: [],
      offers: [],
      adminUsers: []
    };

    try {
      // 1. Create admin users first (needed for service type approval)
      console.log('👑 Creating admin users...');
      seededData.adminUsers = await this.seedAdminUsers(dataset.users.slice(0, 2));

      // 2. Seed service types (requires admin)
      console.log('🏷️ Seeding service types...');
      seededData.serviceTypes = await this.seedServiceTypes(dataset.serviceTypes);

      // 3. Seed mediums of exchange (requires admin)
      console.log('💰 Seeding mediums of exchange...');
      seededData.mediumsOfExchange = await this.seedMediumsOfExchange(dataset.mediumsOfExchange);

      // 4. Seed regular users
      console.log('👥 Seeding users...');
      seededData.users = await this.seedUsers(dataset.users.slice(2)); // Skip admin users

      // 5. Seed organizations
      console.log('🏢 Seeding organizations...');
      seededData.organizations = await this.seedOrganizations(dataset.organizations);

      // 6. Generate and seed requests/offers with real service type hashes
      const serviceTypeHashes = seededData.serviceTypes.map(st => st.actionHash);
      const mediumHashes = seededData.mediumsOfExchange.map(me => me.actionHash);

      console.log('📝 Seeding requests...');
      const requests = RealisticDataGenerator.generateRequests(15, serviceTypeHashes);
      seededData.requests = await this.seedRequests(requests, serviceTypeHashes, mediumHashes);

      console.log('💼 Seeding offers...');
      const offers = RealisticDataGenerator.generateOffers(20, serviceTypeHashes);
      seededData.offers = await this.seedOffers(offers, serviceTypeHashes, mediumHashes);

      console.log('✅ Complete dataset seeding finished!');
      return seededData;

    } catch (error) {
      console.error('❌ Error during dataset seeding:', error);
      throw error;
    }
  }

  // ========================================================================
  // INDIVIDUAL ENTITY SEEDING
  // ========================================================================

  async seedAdminUsers(users: User[]): Promise<SeededUser[]> {
    const seededUsers: SeededUser[] = [];
    
    for (const user of users) {
      try {
        // Create user profile
        const userRecord = await this.client.callZome({
          role_name: 'requests_and_offers',
          zome_name: 'users_organizations',
          fn_name: 'create_user',
          payload: user
        }) as Record;

        // Register as admin
        await this.client.callZome({
          role_name: 'requests_and_offers',
          zome_name: 'administration',
          fn_name: 'register_administrator',
          payload: {
            entity: 'network',
            entity_original_action_hash: userRecord.signed_action.hashed.hash,
            agent_pubkeys: [userRecord.signed_action.hashed.content.author]
          }
        });

        seededUsers.push({
          data: user,
          actionHash: userRecord.signed_action.hashed.hash,
          record: userRecord,
          isAdmin: true
        });

        console.log(`  ✓ Created admin user: ${user.name}`);
      } catch (error) {
        console.error(`  ❌ Failed to create admin user ${user.name}:`, error);
        throw error;
      }
    }

    return seededUsers;
  }

  async seedUsers(users: User[]): Promise<SeededUser[]> {
    const seededUsers: SeededUser[] = [];
    
    for (const user of users) {
      try {
        const record = await this.client.callZome({
          role_name: 'requests_and_offers',
          zome_name: 'users_organizations',
          fn_name: 'create_user',
          payload: user
        }) as Record;

        seededUsers.push({
          data: user,
          actionHash: record.signed_action.hashed.hash,
          record,
          isAdmin: false
        });

        console.log(`  ✓ Created user: ${user.name}`);
      } catch (error) {
        console.error(`  ❌ Failed to create user ${user.name}:`, error);
      }
    }

    return seededUsers;
  }

  async seedOrganizations(organizations: Organization[]): Promise<SeededOrganization[]> {
    const seededOrgs: SeededOrganization[] = [];
    
    for (const org of organizations) {
      try {
        const record = await this.client.callZome({
          role_name: 'requests_and_offers',
          zome_name: 'users_organizations',
          fn_name: 'create_organization',
          payload: org
        }) as Record;

        seededOrgs.push({
          data: org,
          actionHash: record.signed_action.hashed.hash,
          record
        });

        console.log(`  ✓ Created organization: ${org.name}`);
      } catch (error) {
        console.error(`  ❌ Failed to create organization ${org.name}:`, error);
      }
    }

    return seededOrgs;
  }

  async seedServiceTypes(serviceTypes: ServiceType[]): Promise<SeededServiceType[]> {
    const seededTypes: SeededServiceType[] = [];
    
    for (const serviceType of serviceTypes) {
      try {
        const record = await this.client.callZome({
          role_name: 'requests_and_offers',
          zome_name: 'service_types',
          fn_name: 'create_service_type',
          payload: { service_type: serviceType }
        }) as Record;

        seededTypes.push({
          data: serviceType,
          actionHash: record.signed_action.hashed.hash,
          record
        });

        console.log(`  ✓ Created service type: ${serviceType.name}`);
      } catch (error) {
        console.error(`  ❌ Failed to create service type ${serviceType.name}:`, error);
      }
    }

    return seededTypes;
  }

  async seedMediumsOfExchange(mediums: MediumOfExchange[]): Promise<SeededMediumOfExchange[]> {
    const seededMediums: SeededMediumOfExchange[] = [];
    
    for (const medium of mediums) {
      try {
        const record = await this.client.callZome({
          role_name: 'requests_and_offers',
          zome_name: 'mediums_of_exchange',
          fn_name: 'suggest_medium_of_exchange',
          payload: { medium_of_exchange: medium }
        }) as Record;

        seededMediums.push({
          data: medium,
          actionHash: record.signed_action.hashed.hash,
          record
        });

        console.log(`  ✓ Created medium of exchange: ${medium.name}`);
      } catch (error) {
        console.error(`  ❌ Failed to create medium ${medium.name}:`, error);
      }
    }

    return seededMediums;
  }

  async seedRequests(requests: Request[], serviceTypeHashes: ActionHash[], mediumHashes: ActionHash[]): Promise<SeededRequest[]> {
    const seededRequests: SeededRequest[] = [];
    
    for (const request of requests) {
      try {
        // Randomly select service types and mediums for this request
        const selectedServiceTypes = this.randomSelection(serviceTypeHashes, 1, 3);
        const selectedMediums = this.randomSelection(mediumHashes, 1, 2);

        const record = await this.client.callZome({
          role_name: 'requests_and_offers',
          zome_name: 'requests',
          fn_name: 'create_request',
          payload: {
            request,
            organization: null, // For now, not linking to organizations
            service_type_hashes: selectedServiceTypes,
            medium_of_exchange_hashes: selectedMediums
          }
        }) as Record;

        seededRequests.push({
          data: request,
          actionHash: record.signed_action.hashed.hash,
          record,
          serviceTypeHashes: selectedServiceTypes,
          mediumOfExchangeHashes: selectedMediums
        });

        console.log(`  ✓ Created request: ${request.title}`);
      } catch (error) {
        console.error(`  ❌ Failed to create request ${request.title}:`, error);
      }
    }

    return seededRequests;
  }

  async seedOffers(offers: Offer[], serviceTypeHashes: ActionHash[], mediumHashes: ActionHash[]): Promise<SeededOffer[]> {
    const seededOffers: SeededOffer[] = [];
    
    for (const offer of offers) {
      try {
        // Randomly select service types and mediums for this offer
        const selectedServiceTypes = this.randomSelection(serviceTypeHashes, 1, 3);
        const selectedMediums = this.randomSelection(mediumHashes, 1, 2);

        const record = await this.client.callZome({
          role_name: 'requests_and_offers',
          zome_name: 'offers',
          fn_name: 'create_offer',
          payload: {
            offer,
            organization: null, // For now, not linking to organizations
            service_type_hashes: selectedServiceTypes,
            medium_of_exchange_hashes: selectedMediums
          }
        }) as Record;

        seededOffers.push({
          data: offer,
          actionHash: record.signed_action.hashed.hash,
          record,
          serviceTypeHashes: selectedServiceTypes,
          mediumOfExchangeHashes: selectedMediums
        });

        console.log(`  ✓ Created offer: ${offer.title}`);
      } catch (error) {
        console.error(`  ❌ Failed to create offer ${offer.title}:`, error);
      }
    }

    return seededOffers;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private randomSelection<T>(array: T[], min: number, max: number): T[] {
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SeededUser {
  data: User;
  actionHash: ActionHash;
  record: Record;
  isAdmin: boolean;
}

export interface SeededOrganization {
  data: Organization;
  actionHash: ActionHash;
  record: Record;
}

export interface SeededServiceType {
  data: ServiceType;
  actionHash: ActionHash;
  record: Record;
}

export interface SeededMediumOfExchange {
  data: MediumOfExchange;
  actionHash: ActionHash;
  record: Record;
}

export interface SeededRequest {
  data: Request;
  actionHash: ActionHash;
  record: Record;
  serviceTypeHashes: ActionHash[];
  mediumOfExchangeHashes: ActionHash[];
}

export interface SeededOffer {
  data: Offer;
  actionHash: ActionHash;
  record: Record;
  serviceTypeHashes: ActionHash[];
  mediumOfExchangeHashes: ActionHash[];
}

export interface SeededData {
  users: SeededUser[];
  organizations: SeededOrganization[];
  serviceTypes: SeededServiceType[];
  mediumsOfExchange: SeededMediumOfExchange[];
  requests: SeededRequest[];
  offers: SeededOffer[];
  adminUsers: SeededUser[];
}
