import { execSync, spawn, ChildProcess } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { AppWebsocket, type AppInfoResponse } from '@holochain/client';
import { HolochainDataSeeder, type SeededData } from '../fixtures/holochain-data-seeder';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// HOLOCHAIN TEST ENVIRONMENT MANAGER
// ============================================================================

export class HolochainTestEnvironment {
  private conductorProcess: ChildProcess | null = null;
  private client: AppWebsocket | null = null;
  private seededData: SeededData | null = null;
  private readonly projectRoot: string;
  private readonly testWorkdir: string;

  constructor(testSuiteName: string = 'default') {
    this.projectRoot = join(__dirname, '../../../..');
    this.testWorkdir = join(this.projectRoot, `workdir-test-${testSuiteName}-${Date.now()}`);
  }

  // ========================================================================
  // LIFECYCLE MANAGEMENT
  // ========================================================================

  /**
   * Sets up a complete Holochain test environment with seeded data
   */
  async setup(options: TestSetupOptions = {}): Promise<HolochainTestContext> {
    console.log('🚀 Setting up Holochain test environment...');
    
    try {
      // 1. Start fresh conductor
      await this.startConductor();
      
      // 2. Connect client
      await this.connectClient();
      
      // 3. Seed data if requested
      if (options.seedData !== false) {
        await this.seedTestData(options.seedOptions);
      }

      console.log('✅ Holochain test environment ready!');
      
      return {
        client: this.client!,
        seededData: this.seededData,
        workdir: this.testWorkdir,
        cleanup: () => this.cleanup()
      };

    } catch (error) {
      console.error('❌ Failed to setup Holochain test environment:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Starts a fresh Holochain conductor for testing
   */
  private async startConductor(): Promise<void> {
    console.log('🔧 Starting Holochain conductor...');
    
    const happPath = join(this.projectRoot, 'workdir/requests_and_offers.happ');

    try {
      // Create isolated test workdir
      execSync(`mkdir -p ${this.testWorkdir}`, {
        stdio: 'inherit',
        cwd: this.projectRoot
      });

      // Generate conductor configuration
      execSync(`nix develop --command hc sandbox generate --root ${this.testWorkdir}`, {
        stdio: 'inherit',
        cwd: this.projectRoot
      });

      // Start conductor in background
      console.log('  📡 Starting conductor process...');
      this.conductorProcess = spawn('nix', [
        'develop',
        '--command',
        'hc',
        'sandbox',
        'run',
        '--root',
        this.testWorkdir
      ], {
        cwd: this.projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      // Handle conductor output
      this.conductorProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Conductor ready')) {
          console.log('  ✓ Conductor is ready');
        }
      });

      this.conductorProcess.stderr?.on('data', (data) => {
        console.error('Conductor error:', data.toString());
      });

      // Wait for conductor to be ready
      await this.waitForConductor();

      // Install and activate happ
      console.log('  📦 Installing happ...');
      execSync(`nix develop --command hc sandbox call install-app '${happPath}' --root ${this.testWorkdir}`, {
        stdio: 'inherit',
        cwd: this.projectRoot
      });

      console.log('  🔌 Activating happ...');
      execSync(`nix develop --command hc sandbox call activate-app requests_and_offers --root ${this.testWorkdir}`, {
        stdio: 'inherit',
        cwd: this.projectRoot
      });

      console.log('  ✅ Conductor setup complete');

    } catch (error) {
      console.error('❌ Failed to start conductor:', error);
      throw error;
    }
  }

  /**
   * Connects the WebSocket client to the conductor
   */
  private async connectClient(): Promise<void> {
    console.log('🔗 Connecting to Holochain conductor...');
    
    const maxRetries = 10;
    const retryDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.client = await AppWebsocket.connect('ws://localhost:8888');
        
        // Verify connection with a ping
        const appInfo = await this.client.appInfo();
        if (appInfo) {
          console.log('  ✅ Client connected successfully');
          return;
        }
      } catch (error) {
        console.log(`  ⏳ Connection attempt ${attempt}/${maxRetries} failed, retrying...`);
        if (attempt === maxRetries) {
          throw new Error(`Failed to connect after ${maxRetries} attempts: ${error}`);
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  /**
   * Seeds the Holochain DNA with realistic test data
   */
  private async seedTestData(options: SeedOptions = {}): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    console.log('🌱 Seeding test data...');
    
    const seeder = new HolochainDataSeeder(this.client);
    
    if (options.useCompleteDataset !== false) {
      this.seededData = await seeder.seedCompleteDataset();
    } else {
      // Custom seeding logic could go here
      console.log('  ℹ️ Custom seeding not implemented yet');
    }

    console.log('  ✅ Test data seeded successfully');
  }

  /**
   * Waits for the conductor to be ready
   */
  private async waitForConductor(): Promise<void> {
    const maxWait = 30000; // 30 seconds
    const checkInterval = 500; // 500ms
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      try {
        // Try to connect to check if conductor is ready
        const testClient = await AppWebsocket.connect('ws://localhost:8888');
        await testClient.appInfo();
        await testClient.client.close();
        return;
      } catch (error) {
        // Conductor not ready yet, wait and retry
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }

    throw new Error('Conductor failed to start within timeout period');
  }

  /**
   * Cleans up the test environment
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test environment...');

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
      try {
        execSync(`rm -rf ${this.testWorkdir}`, {
          stdio: 'ignore',
          cwd: this.projectRoot
        });
      } catch (error) {
        console.warn('  ⚠️ Failed to remove test workdir:', error);
      }

      // Reset state
      this.seededData = null;

      console.log('  ✅ Cleanup complete');

    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Gets the current seeded data
   */
  getSeededData(): SeededData | null {
    return this.seededData;
  }

  /**
   * Gets the connected client
   */
  getClient(): AppWebsocket | null {
    return this.client;
  }

  /**
   * Resets the DNA state (useful between tests)
   */
  async resetDnaState(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    console.log('🔄 Resetting DNA state...');
    
    // For now, we'll restart the entire conductor
    // In the future, this could be optimized to just clear the DNA state
    await this.cleanup();
    await this.setup();
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TestSetupOptions {
  seedData?: boolean;
  seedOptions?: SeedOptions;
}

export interface SeedOptions {
  useCompleteDataset?: boolean;
  customUsers?: number;
  customOrganizations?: number;
  customRequests?: number;
  customOffers?: number;
}

export interface HolochainTestContext {
  client: AppWebsocket;
  seededData: SeededData | null;
  workdir: string;
  cleanup: () => Promise<void>;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Creates a new test environment for a test suite
 */
export async function createTestEnvironment(testSuiteName?: string, options?: TestSetupOptions): Promise<HolochainTestContext> {
  const env = new HolochainTestEnvironment(testSuiteName);
  return await env.setup(options);
}

/**
 * Quick setup for tests that need minimal data
 */
export async function createMinimalTestEnvironment(testSuiteName?: string): Promise<HolochainTestContext> {
  return createTestEnvironment(testSuiteName, {
    seedData: false
  });
}

/**
 * Quick setup for tests that need full realistic data
 */
export async function createFullTestEnvironment(testSuiteName?: string): Promise<HolochainTestContext> {
  return createTestEnvironment(testSuiteName, {
    seedData: true,
    seedOptions: {
      useCompleteDataset: true
    }
  });
}
