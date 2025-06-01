import { AppWebsocket, type AppInfoResponse } from '@holochain/client';
import { Context, Layer } from 'effect';
// import { Context, Layer } from 'effect';

export type ZomeName =
  | 'users_organizations'
  | 'requests'
  | 'offers'
  | 'administration'
  | 'service_types'
  | 'misc';
export type RoleName = 'requests_and_offers' | 'hrea_combined';

// Define the interface for HolochainClientService
export interface HolochainClientService {
  readonly appId: string;
  readonly client: AppWebsocket | null;
  readonly isConnected: boolean;
  connectClient(): Promise<void>;
  getAppInfo(): Promise<AppInfoResponse>;
  callZome(
    zomeName: ZomeName,
    fnName: string,
    payload: unknown,
    capSecret?: Uint8Array | null,
    roleName?: RoleName
  ): Promise<unknown>;
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

  /**
   * Connects the client to the Host backend.
   */
  async function connectClient(): Promise<void> {
    client = await AppWebsocket.connect();
    isConnected = true;
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
  async function callZome(
    zomeName: ZomeName,
    fnName: string,
    payload: unknown,
    capSecret: Uint8Array | null = null,
    roleName: RoleName = 'requests_and_offers'
  ): Promise<unknown> {
    if (!client) {
      throw new Error('Client not connected');
    }

    try {
      const record = await client.callZome({
        cap_secret: capSecret,
        zome_name: zomeName,
        fn_name: fnName,
        payload,
        role_name: roleName
      });

      return record;
    } catch (error) {
      console.error(`Error calling zome function ${zomeName}.${fnName}:`, error);
      throw error;
    }
  }

  // Return the service object with state and methods
  return {
    // State (with getters)
    get appId() {
      return appId;
    },
    get client() {
      return client;
    },
    get isConnected() {
      return isConnected;
    },

    // Methods
    connectClient,
    getAppInfo,
    callZome
  };
}

// Create a singleton instance of the service
const holochainClientService = createHolochainClientService();
export default holochainClientService;

// Effect integration

// Context Tag for Effect integration
export class HolochainClientServiceTag extends Context.Tag('HolochainClientService')<
  HolochainClientServiceTag,
  HolochainClientService
>() {}

// Live Layer implementation
export const HolochainClientServiceLive: Layer.Layer<HolochainClientServiceTag> = Layer.succeed(
  HolochainClientServiceTag,
  holochainClientService
);
