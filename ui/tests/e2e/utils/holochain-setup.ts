import { execSync, spawn, ChildProcess } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { AppWebsocket } from '@holochain/client';
import { HolochainDataSeeder, type SeededData } from '../fixtures/holochain-data-seeder';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// HOLOCHAIN E2E TEST SETUP
// ============================================================================

export class HolochainE2ESetup {
  private conductorProcess: ChildProcess | null = null;
  private client: AppWebsocket | null = null;
  private seededData: SeededData | null = null;
  private readonly projectRoot: string;
  private readonly testWorkdir: string;

  constructor() {
    this.projectRoot = join(__dirname, '../../../..');
    this.testWorkdir = join(this.projectRoot, 'test-workdir');
  }

  // ========================================================================
  // MAIN SETUP/TEARDOWN METHODS
  // ========================================================================

  /**
   * Complete setup for E2E tests with real Holochain data
   */
  async setupForE2E(): Promise<{ client: AppWebsocket; seededData: SeededData }> {
    console.log('🚀 Setting up Holochain for E2E tests...');

    try {
      // 1. Start fresh conductor
      await this.startFreshConductor();

      // 2. Connect client
      await this.connectClient();

      // 3. Seed realistic data
      await this.seedRealisticData();

      console.log('✅ Holochain E2E setup complete!');
      return {
        client: this.client!,
        seededData: this.seededData!
      };
    } catch (error) {
      console.error('❌ Failed to setup Holochain for E2E:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Clean up all resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up Holochain E2E setup...');

    try {
      // Close client connection
      if (this.client) {
        await this.client.client.close();
        this.client = null;
      }

      // Stop conductor process
      if (this.conductorProcess) {
        this.conductorProcess.kill('SIGTERM');
        this.conductorProcess = null;
      }

      // Clean up test workdir
      await this.cleanTestWorkdir();

      console.log('✅ Cleanup complete');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  // ========================================================================
  // CONDUCTOR MANAGEMENT
  // ========================================================================

  private async startFreshConductor(): Promise<void> {
    console.log('🔧 Starting fresh Holochain conductor...');

    // Clean any existing test workdir
    await this.cleanTestWorkdir();

    // Create test workdir
    execSync(`mkdir -p ${this.testWorkdir}`, {
      stdio: 'inherit',
      cwd: this.projectRoot
    });

    // Generate sandbox in test workdir
    execSync(`nix develop --command hc sandbox generate --root ${this.testWorkdir}`, {
      stdio: 'inherit',
      cwd: this.projectRoot
    });

    // Start conductor in background
    console.log('🎯 Starting conductor process...');
    this.conductorProcess = spawn(
      'nix',
      ['develop', '--command', 'hc', 'sandbox', 'run', '--root', this.testWorkdir],
      {
        cwd: this.projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      }
    );

    // Handle conductor output
    this.conductorProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Conductor ready')) {
        console.log('✅ Conductor is ready');
      }
    });

    this.conductorProcess.stderr?.on('data', (data) => {
      console.error('Conductor error:', data.toString());
    });

    // Wait for conductor to be ready
    await this.waitForConductorReady();

    // Install and activate happ
    await this.installAndActivateHapp();
  }

  private async waitForConductorReady(): Promise<void> {
    console.log('⏳ Waiting for conductor to be ready...');

    const maxAttempts = 30;
    const delayMs = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Try to connect to see if conductor is ready
        const testClient = await AppWebsocket.connect({ url: new URL('ws://localhost:8888') });
        await testClient.client.close();
        console.log('✅ Conductor is ready for connections');
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error(`Conductor failed to start after ${maxAttempts} attempts`);
        }
        console.log(`  Attempt ${attempt}/${maxAttempts} - waiting...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  private async installAndActivateHapp(): Promise<void> {
    console.log('📦 Installing and activating happ...');

    const happPath = join(this.projectRoot, 'workdir', 'requests_and_offers.happ');

    // Install happ
    execSync(
      `nix develop --command hc sandbox call install-app '${happPath}' --root ${this.testWorkdir}`,
      {
        stdio: 'inherit',
        cwd: this.projectRoot
      }
    );

    // Activate happ
    execSync(
      `nix develop --command hc sandbox call activate-app requests_and_offers --root ${this.testWorkdir}`,
      {
        stdio: 'inherit',
        cwd: this.projectRoot
      }
    );

    console.log('✅ Happ installed and activated');
  }

  private async cleanTestWorkdir(): Promise<void> {
    try {
      execSync(`rm -rf ${this.testWorkdir}`, {
        stdio: 'ignore',
        cwd: this.projectRoot
      });
    } catch (error) {
      // Ignore errors - directory might not exist
    }
  }

  // ========================================================================
  // CLIENT CONNECTION
  // ========================================================================

  private async connectClient(): Promise<void> {
    console.log('🔌 Connecting to Holochain conductor...');

    const maxAttempts = 10;
    const delayMs = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.client = await AppWebsocket.connect({ url: new URL('ws://localhost:8888') });

        // Test the connection with a ping
        await this.client.callZome({
          role_name: 'requests_and_offers',
          zome_name: 'misc',
          fn_name: 'ping',
          payload: null
        });

        console.log('✅ Connected to Holochain conductor');
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error(`Failed to connect to conductor after ${maxAttempts} attempts: ${error}`);
        }
        console.log(`  Connection attempt ${attempt}/${maxAttempts} failed, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // ========================================================================
  // DATA SEEDING
  // ========================================================================

  private async seedRealisticData(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected - cannot seed data');
    }

    console.log('🌱 Seeding realistic test data...');

    const seeder = new HolochainDataSeeder(this.client);
    this.seededData = await seeder.seedCompleteDataset();

    console.log('✅ Test data seeded successfully');
    console.log(`  👥 Users: ${this.seededData.users.length + this.seededData.adminUsers.length}`);
    console.log(`  🏢 Organizations: ${this.seededData.organizations.length}`);
    console.log(`  🏷️ Service Types: ${this.seededData.serviceTypes.length}`);
    console.log(`  💰 Mediums of Exchange: ${this.seededData.mediumsOfExchange.length}`);
    console.log(`  📝 Requests: ${this.seededData.requests.length}`);
    console.log(`  💼 Offers: ${this.seededData.offers.length}`);
  }

  // ========================================================================
  // GETTERS
  // ========================================================================

  getClient(): AppWebsocket {
    if (!this.client) {
      throw new Error('Client not connected');
    }
    return this.client;
  }

  getSeededData(): SeededData {
    if (!this.seededData) {
      throw new Error('Data not seeded yet');
    }
    return this.seededData;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Reset data by cleaning and re-seeding
   */
  async resetData(): Promise<void> {
    console.log('🔄 Resetting test data...');

    // Stop current conductor
    if (this.conductorProcess) {
      this.conductorProcess.kill('SIGTERM');
      this.conductorProcess = null;
    }

    if (this.client) {
      await this.client.client.close();
      this.client = null;
    }

    // Start fresh
    await this.startFreshConductor();
    await this.connectClient();
    await this.seedRealisticData();

    console.log('✅ Data reset complete');
  }

  /**
   * Get a specific user by name for testing
   */
  getUserByName(name: string): any {
    if (!this.seededData) return null;

    const allUsers = [...this.seededData.users, ...this.seededData.adminUsers];
    return allUsers.find((user) => user.data.name === name);
  }

  /**
   * Get a specific organization by name for testing
   */
  getOrganizationByName(name: string): any {
    if (!this.seededData) return null;

    return this.seededData.organizations.find((org) => org.data.name === name);
  }

  /**
   * Get service type by name for testing
   */
  getServiceTypeByName(name: string): any {
    if (!this.seededData) return null;

    return this.seededData.serviceTypes.find((st) => st.data.name === name);
  }
}

// ============================================================================
// SINGLETON INSTANCE FOR GLOBAL USE
// ============================================================================

let globalHolochainSetup: HolochainE2ESetup | null = null;

export function getGlobalHolochainSetup(): HolochainE2ESetup {
  if (!globalHolochainSetup) {
    globalHolochainSetup = new HolochainE2ESetup();
  }
  return globalHolochainSetup;
}

export async function setupGlobalHolochain(): Promise<{
  client: AppWebsocket;
  seededData: SeededData;
}> {
  const setup = getGlobalHolochainSetup();
  return await setup.setupForE2E();
}

export async function cleanupGlobalHolochain(): Promise<void> {
  if (globalHolochainSetup) {
    await globalHolochainSetup.cleanup();
    globalHolochainSetup = null;
  }
}
