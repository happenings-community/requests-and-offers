import { type AppClient, type AppInfoResponse, AppWebsocket, type PeerMetaInfoResponse, encodeHashToBase64 } from '@holochain/client';
import { Context, Layer } from 'effect';
import { isWeaveContext, WeaveClient } from '@theweave/api';
import type { ProfilesClient } from '@holochain-open-dev/profiles';


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
  readonly client: AppClient | null;
  readonly profilesClient: ProfilesClient | null;
  readonly weaveClient: WeaveClient | null;
  readonly isWeaveContext: boolean;
  readonly isConnected: boolean;
  readonly isConnecting: boolean;

  connectClient(): Promise<void>;
  waitForConnection(): Promise<void>;

  getAppInfo(): Promise<AppInfoResponse>;
  getPeerMetaInfo(): Promise<PeerMetaInfoResponse>;

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
  getNetworkPeers(): Promise<string[]>;
  isGroupProgenitor(): Promise<boolean>;
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
  let client: AppClient | null = $state(null);
  let weaveClient: WeaveClient | null = $state(null);
  let profilesClient: ProfilesClient | null = $state(null);
  let inWeaveContext: boolean = $state(false);
  let isConnected: boolean = $state(false);
  let isConnecting: boolean = $state(false);

  /**
   * Connects the client to the Host backend with retry logic.
   * Automatically detects Weave/Moss context and uses appropriate connection method.
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
    weaveClient = null;
    isConnecting = true;

    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        console.log(`Attempting to connect to Holochain (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Check if running in Weave/Moss context
        if (isWeaveContext()) {
          console.log('🧶 Detected Weave context, connecting via WeaveClient...');
          inWeaveContext = true;
          weaveClient = await WeaveClient.connect();
          
          if (weaveClient.renderInfo.type !== 'applet-view') {
            throw new Error('Cross-group views not yet implemented');
          }
          
          client = weaveClient.renderInfo.appletClient;
          profilesClient = weaveClient.renderInfo.profilesClient;
          console.log('✅ Successfully connected via WeaveClient');
        } else {
          console.log('📡 Standalone mode, connecting via AppWebsocket...');
          inWeaveContext = false;
          client = await AppWebsocket.connect();
          console.log('✅ Successfully connected to Holochain');
        }
        
        isConnected = true;
        isConnecting = false;

        return;
      } catch (error) {
        retryCount++;
        console.warn(`❌ Connection attempt ${retryCount} failed:`, error);

        if (retryCount === maxRetries) {
          console.error('Failed to connect to Holochain after', maxRetries, 'attempts');
          isConnected = false;
          isConnecting = false;
          client = null;
          weaveClient = null;
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

  async function getPeerMetaInfo(): Promise<PeerMetaInfoResponse> {
    if (!client) {
      throw new Error('Client not connected');
    }

    // agentInfo/peerMetaInfo are only available on AppWebsocket, not the generic AppClient interface
    if (!(client instanceof AppWebsocket)) {
      return {};
    }

    const agentInfos = await client.agentInfo({ dna_hashes: null });

    if (!agentInfos || agentInfos.length === 0) {
      return {};
    }

    // Collect peer meta info from all agents
    const allPeerMetaInfo: PeerMetaInfoResponse = {};

    for (const agentInfoStr of agentInfos) {
      try {
        const agentInfo = JSON.parse(agentInfoStr);
        if (agentInfo.agentInfo) {
          const parsedAgentInfo = JSON.parse(agentInfo.agentInfo);
          if (parsedAgentInfo.url) {
            const peerMetaInfo = await client.peerMetaInfo({ url: parsedAgentInfo.url });
            // Merge peer info, avoiding duplicates
            for (const [key, value] of Object.entries(peerMetaInfo)) {
              if (!allPeerMetaInfo[key]) {
                allPeerMetaInfo[key] = value as PeerMetaInfoResponse[string];
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to parse agent info:', error);
      }
    }

    return allPeerMetaInfo;
  }

  // Define interfaces for agent info response
  interface AgentInfo {
    agent_pub_key?: string;
    agentInfo?: string | { agent?: string };
  }

  interface ParsedAgentInfo {
    agent?: string;
    space?: string;
    createdAt?: string;
    expiresAt?: string;
    isTombstone?: boolean;
    url?: string;
    storageArc?: [number, number];
  }

  async function getNetworkPeers(): Promise<string[]> {
    if (!client) {
      throw new Error('Client not connected');
    }

    try {
      // agentInfo is only available on AppWebsocket, not the generic AppClient interface
      if (!(client instanceof AppWebsocket)) {
        return [];
      }

      // Get all agent infos and extract agent pub keys
      const agentInfos = await client.agentInfo({ dna_hashes: null });
      const peerKeys: string[] = [];

      // Handle different response formats
      if (Array.isArray(agentInfos)) {
        for (const agentInfoItem of agentInfos) {
          try {
            // Approach 1: If it's already an object with agent_pub_key
            if (
              typeof agentInfoItem === 'object' &&
              agentInfoItem !== null &&
              'agent_pub_key' in agentInfoItem
            ) {
              const agentInfo = agentInfoItem as AgentInfo;
              const agentPubKey = agentInfo.agent_pub_key;
              if (agentPubKey && typeof agentPubKey === 'string') {
                peerKeys.push(agentPubKey);
              }
            }
            // Approach 2: If it's a string that needs parsing
            else if (typeof agentInfoItem === 'string') {
              const agentInfo = JSON.parse(agentInfoItem) as AgentInfo;

              // Check nested structure - the agent key is in agentInfo.agent
              if (agentInfo.agentInfo && typeof agentInfo.agentInfo === 'string') {
                const parsedAgentInfo = JSON.parse(agentInfo.agentInfo) as ParsedAgentInfo;
                if (parsedAgentInfo.agent && typeof parsedAgentInfo.agent === 'string') {
                  peerKeys.push(parsedAgentInfo.agent);
                }
              }
            }
          } catch (error) {
            console.warn(`Failed to parse agent info:`, error);
          }
        }
      } else if (typeof agentInfos === 'object' && agentInfos !== null && 'agent_pub_key' in agentInfos) {
        // Try treating agentInfos as a single object
        const agentInfo = agentInfos as AgentInfo;
        const agentPubKey = agentInfo.agent_pub_key;
        if (agentPubKey && typeof agentPubKey === 'string') {
          peerKeys.push(agentPubKey);
        }
      }

      // Remove duplicates while preserving order
      const uniquePeerKeys = [...new Set(peerKeys)];
      return uniquePeerKeys;
    } catch (error) {
      console.error('Failed to get network peers:', error);
      return [];
    }
  }

  /**
   * Check if current agent is the Moss group progenitor (creator)
   * Returns false if not in Weave context
   */
  async function isGroupProgenitor(): Promise<boolean> {
    if (!inWeaveContext || !weaveClient) {
      return false;
    }

    try {
      // Get the applet hash from render info
      const renderInfo = weaveClient.renderInfo;
      if (renderInfo.type !== 'applet-view') {
        console.debug('ℹ️ isGroupProgenitor: Not in applet view context');
        return false;
      }

      const appletHash = renderInfo.appletHash;
      
      // Get the pubkey of whoever installed this tool
      const installerPubKey = await weaveClient.toolInstaller(appletHash);
      
      if (!installerPubKey) {
        console.debug('ℹ️ isGroupProgenitor: Could not determine tool installer');
        return false;
      }

      // Get current agent's pubkey
      const myPubKey = client?.myPubKey;
      if (!myPubKey) {
        console.debug('ℹ️ isGroupProgenitor: Could not get current agent pubkey');
        return false;
      }

      // Compare pubkeys - if they match, I'm the tool installer (progenitor)
      const installerB64 = encodeHashToBase64(installerPubKey);
      const myB64 = encodeHashToBase64(myPubKey);
      const isProgenitor = installerB64 === myB64;

      console.debug(
        `🔍 isGroupProgenitor: ${isProgenitor ? 'Current agent IS the tool installer (progenitor)' : 'Current agent is NOT the tool installer'}`
      );

      return isProgenitor;
    } catch (error) {
      console.warn('Failed to check progenitor status:', error);
      return false;
    }
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
    get weaveClient() {
      return weaveClient;
    },
    get isWeaveContext() {
      return inWeaveContext;
    },
    get profilesClient() {
      return profilesClient;
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
    getPeerMetaInfo,
    callZome,
    verifyConnection,
    getNetworkSeed,
    getNetworkInfo,
    getNetworkPeers,
    isGroupProgenitor
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
