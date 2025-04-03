import type {
  AppWebsocket,
  AppInfo,
  NonProvenanceCallZomeRequest,
  ZomeName,
  FunctionName
} from '@holochain/client';
import { type Player, Conductor } from '@holochain/tryorama';

/**
 * A Holochain client implementation that uses Tryorama for real DNA interactions
 * in tests. This allows UI tests to interact with a real Holochain conductor.
 */
export class HolochainClientMock implements Partial<AppWebsocket> {
  private player: Player;
  private cellIndex: number;
  isConnected = true;

  /**
   * Creates a new TryoramaHolochainClient
   * @param player - The Tryorama player representing an agent
   * @param cellIndex - The index of the cell to use (default: 0)
   */
  constructor(player: Player, cellIndex = 0) {
    this.player = player;
    this.cellIndex = cellIndex;
  }

  /**
   * Gets information about the installed app
   */
  async appInfo(): Promise<AppInfo> {
    const cellId = this.player.cells[this.cellIndex].cell_id;

    return {
      installed_app_id: 'requests_and_offers',
      agent_pub_key: cellId[1], // Agent public key from cell ID
      cell_info: {},
      status: 'running'
    };
  }

  /**
   * Calls a zome function using the Tryorama player
   * @param request - The zome call request
   * @returns The result of the zome call
   */
  async callZome(request: NonProvenanceCallZomeRequest): Promise<unknown> {
    const { zome_name, fn_name, payload } = request;

    try {
      // Use the Tryorama player to make the actual zome call
      return await this.player.cells[this.cellIndex].callZome({
        zome_name: zome_name as ZomeName,
        fn_name: fn_name as FunctionName,
        payload
      });
    } catch (error) {
      console.error(`Error calling zome ${zome_name}.${fn_name}:`, error);
      throw error;
    }
  }
}

/**
 * Helper factory function to create a TryoramaHolochainClient
 * @param player - The Tryorama player
 * @param cellIndex - The index of the cell to use
 * @returns A new TryoramaHolochainClient instance
 */
export function createTryoramaClient(player: Player, cellIndex = 0): HolochainClientMock {
  return new HolochainClientMock(player, cellIndex);
}

/**
 * Setup function to create a test environment with Tryorama
 * @param setupConductor - Function to set up the conductor
 * @returns A cleanup function
 */
export async function setupTryoramaTest(
  setupConductor: (conductor: Conductor) => Promise<Player[]>
): Promise<{
  players: Player[];
  clients: HolochainClientMock[];
  cleanup: () => Promise<void>;
}> {
  // Create a new conductor
  const conductor = await Conductor.create(new URL('http://localhost:1234'));

  // Set up the conductor and get players
  const players = await setupConductor(conductor);

  // Create clients for each player
  const clients = players.map((player) => createTryoramaClient(player));

  // Return players, clients and cleanup function
  return {
    players,
    clients,
    cleanup: async () => {
      await conductor.shutDown();
    }
  };
}
