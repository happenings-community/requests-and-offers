import { type AppInfoResponse, AppWebsocket } from '@holochain/client';
import { Context, Layer } from 'effect';

export type ZomeName =
  | 'users_organizations'
  | 'requests'
  | 'offers'
  | 'administration'
  | 'service_types'
  | 'mediums_of_exchange'
  | 'exchanges'
  | 'misc'
  | 'hrea_economic_event'
  | 'hrea_observation';
export type RoleName = 'requests_and_offers' | 'hrea';

export interface NetworkInfo {
  networkSeed: string;
  dnaHash: string;
  roleName: string;
}

export interface HolochainClientService {
  readonly appId: string;
  readonly client: AppWebsocket | null;
  readonly isConnected: boolean;
  readonly isConnecting: boolean;

  connectClient(): Promise<void>;
  waitForConnection(): Promise<void>;

  getAppInfo(): Promise<AppInfoResponse>;

  callZome(
    zomeName: ZomeName,
    fnName: string,
    payload: unknown,
    capSecret?: Uint8Array | undefined,
    roleName?: RoleName
  ): Promise<unknown>;

  verifyConnection(): Promise<boolean>;

  getNetworkSeed(roleName?: RoleName): Promise<string>;
  getNetworkInfo(roleName?: RoleName): Promise<NetworkInfo>;
}

/**
 * Creates a Holochain client service that manages the connection to the Holochain conductor
 * and provides methods to interact with it.
 *
 * @returns An object with methods to interact with the Holochain conductor
 */
function createHolochainClientService(): HolochainClientService {
  // State
  const appId: string = 'requests_and_offers';
  let client: AppWebsocket | null = $state(null);
  let isConnected: boolean = $state(false);
  let isConnecting: boolean = $state(false);

  /**
   * Connects the client to the Host backend with retry logic.
   */
  async function connectClient(): Promise<void> {
    // If already connected or connecting, handle appropriately
    if (isConnected) return;
    if (isConnecting) {
      // Wait for existing connection to complete
      while (isConnecting) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (isConnected) return;
    }

    // Reset connection state
    isConnected = false;
    client = null;
    isConnecting = true;

    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        console.log(`Attempting to connect to Holochain (attempt ${retryCount + 1}/${maxRetries})`);
        client = await AppWebsocket.connect();
        isConnected = true;
        isConnecting = false;
        console.log('✅ Successfully connected to Holochain');

        return;
      } catch (error) {
        retryCount++;
        console.warn(`❌ Connection attempt ${retryCount} failed:`, error);

        if (retryCount === maxRetries) {
          console.error('Failed to connect to Holochain after', maxRetries, 'attempts');
          isConnected = false;
          isConnecting = false;
          client = null;
          throw error;
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Waits for the client to be connected before proceeding.
   * If not connected, will attempt to establish a connection.
   */
  async function waitForConnection(): Promise<void> {
    if (isConnected) return;

    if (isConnecting) {
      // Wait for existing connection to complete
      while (isConnecting) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (isConnected) return;
    }

    if (!isConnected) {
      await connectClient();
    }
  }

  /**
   * Retrieves application information from the Holochain client.
   * @returns {Promise<AppInfoResponse>} - The application information.
   */
  async function getAppInfo(): Promise<AppInfoResponse> {
    if (!client) {
      throw new Error('Client not connected');
    }
    return await client.appInfo();
  }

  /**
   * Calls a zome function on the Holochain client.
   * @param {ZomeName} zomeName - The name of the zome.
   * @param {string} fnName - The name of the function within the zome.
   * @param {unknown} payload - The payload to send with the function call.
   * @param {Uint8Array | null} capSecret - The capability secret for authorization.
   * @param {RoleName} roleName - The name of the role to call the function on. Defaults to 'requests_and_offers'.
   * @returns {Promise<unknown>} - The result of the zome function call.
   */
  /**
   * Verifies if the client is truly connected and working
   */
  async function verifyConnection(): Promise<boolean> {
    if (!client || !isConnected) {
      return false;
    }

    try {
      // Try to get app info as a connectivity test
      await client.appInfo();
      return true;
    } catch (error) {
      console.warn('Connection verification failed:', error);
      isConnected = false;
      client = null;
      return false;
    }
  }

  /**
   * Gets the network seed for the specified role
   * @param roleName The role name to get the network seed for. Defaults to 'requests_and_offers'
   * @returns Promise<string> The network seed string
   */
  async function getNetworkSeed(roleName: RoleName = 'requests_and_offers'): Promise<string> {
    if (!client) {
      throw new Error('Client not connected');
    }

    return (await client.callZome({
      zome_name: 'misc',
      fn_name: 'get_network_seed',
      payload: null,
      role_name: roleName
    })) as string;
  }

  /**
   * Gets comprehensive network information for the specified role
   * @param roleName The role name to get network info for. Defaults to 'requests_and_offers'
   * @returns Promise<NetworkInfo> Network information including seed, DNA hash, and role name
   */
  async function getNetworkInfo(roleName: RoleName = 'requests_and_offers'): Promise<NetworkInfo> {
    if (!client) {
      throw new Error('Client not connected');
    }

    return (await client.callZome({
      zome_name: 'misc',
      fn_name: 'get_network_info',
      payload: null,
      role_name: roleName
    })) as NetworkInfo;
  }

  async function callZome(
    zomeName: ZomeName,
    fnName: string,
    payload: unknown,
    capSecret: Uint8Array | undefined = undefined,
    roleName: RoleName = 'requests_and_offers'
  ): Promise<unknown> {
    if (!client) {
      throw new Error('Client not connected');
    }

    try {
      return await client.callZome({
        cap_secret: capSecret,
        zome_name: zomeName,
        fn_name: fnName,
        payload,
        role_name: roleName
      });
    } catch (error) {
      console.error(`Error calling zome function ${zomeName}.${fnName}:`, error);

      // Check if this is a connection error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('WebSocket') || errorMessage.includes('connection')) {
        console.warn('Detected connection error, marking as disconnected');
        isConnected = false;
        client = null;
      }

      throw error;
    }
  }

  return {
    // Getters
    get appId() {
      return appId;
    },
    get client() {
      return client;
    },
    get isConnected() {
      return isConnected;
    },
    get isConnecting() {
      return isConnecting;
    },

    // Methods
    connectClient,
    waitForConnection,
    getAppInfo,
    callZome,
    verifyConnection,
    getNetworkSeed,
    getNetworkInfo
  };
}

const holochainClientService = createHolochainClientService();
export default holochainClientService;

export class HolochainClientServiceTag extends Context.Tag('HolochainClientService')<
  HolochainClientServiceTag,
  HolochainClientService
>() {}

// Layer for the Svelte service
export const HolochainClientServiceLive: Layer.Layer<HolochainClientServiceTag> = Layer.succeed(
  HolochainClientServiceTag,
  holochainClientService
);
