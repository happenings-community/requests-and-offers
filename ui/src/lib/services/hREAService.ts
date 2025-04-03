/* eslint-disable @typescript-eslint/no-unused-vars */
import { AdminWebsocket, AppWebsocket, type CellId } from '@holochain/client';
import { mapZomeFn } from '@leosprograms/vf-graphql-holochain';
import type { DNAIdMappings } from '@leosprograms/vf-graphql-holochain';
import gql from 'graphql-tag';

// Types
export interface ExtendedDnaConfig extends DNAIdMappings {
  hrea_combined: CellId;
}

export interface HREAIntent {
  id?: string;
  action: 'offer' | 'request';
  resourceClassifiedAs?: string;
  resourceQuantity?: number;
  description?: string;
}

export interface HREAProposal extends HREAIntent {
  proposalStatus: 'draft' | 'proposed' | 'accepted' | 'rejected';
}

export interface HREACommitment extends HREAProposal {
  committedQuantity: number;
  committedOn: Date;
}

export interface HREAEconomicEvent extends HREACommitment {
  eventDate: Date;
  fulfillmentStatus: 'fulfilled' | 'partially-fulfilled' | 'unfulfilled';
}

// GraphQL Queries and Mutations
const CREATE_INTENT = gql`
  mutation CreateIntent($intent: IntentCreateParams!) {
    createIntent(intent: $intent) {
      intent {
        id
        action
        resourceQuantity
        resourceClassifiedAs
        description
      }
    }
  }
`;

const CREATE_PROPOSAL = gql`
  mutation CreateProposal($proposal: ProposalCreateParams!) {
    createProposal(proposal: $proposal) {
      proposal {
        id
        action
        resourceQuantity
        resourceClassifiedAs
        description
        proposalStatus
      }
    }
  }
`;

export interface HREAService {
  readonly adminPort: number | null;
  readonly appId: string;
  readonly client: AppWebsocket | null;
  readonly isConnected: boolean;
  connectAndAuthorizeCells(): Promise<void>;
  generateAppAuthToken(): Promise<string>;
  connectClient(): Promise<void>;
  callZome(
    zomeName: string,
    fnName: string,
    payload: unknown,
    capSecret?: Uint8Array | null,
    roleName?: string
  ): Promise<unknown>;
  createIntent(intent: HREAIntent): Promise<HREAIntent>;
  convertIntentToProposal(intent: HREAIntent): Promise<HREAProposal>;
  classifyResource(resourceName: string, category: string): Promise<string>;
}

function createHREAService(adminPort?: number): HREAService {
  // State
  const appId = $state('requests_and_offers');
  let client = $state<AppWebsocket | null>(null);
  let isConnected = $state(false);
  const port = adminPort || null;

  /**
   * Connects to the admin websocket and authorizes cells
   */
  async function connectAndAuthorizeCells(): Promise<void> {
    if (!port) {
      console.log('No admin port provided');
      return;
    }

    try {
      const adminWebsocket = await AdminWebsocket.connect({
        url: new URL(`ws://localhost:${port}`)
      });

      const cellIds = await adminWebsocket.listCellIds();

      // Authorize each cell's signing credentials
      for (const cellId of cellIds) {
        await adminWebsocket.authorizeSigningCredentials(cellId);
      }

      console.log(`Authorized ${cellIds.length} cells`);
    } catch (error) {
      console.error('Error connecting to admin websocket:', error);
      throw error;
    }
  }

  /**
   * Generates an app authentication token
   */
  async function generateAppAuthToken(): Promise<string> {
    if (!port) {
      throw new Error('No admin port provided');
    }

    const adminConn = await AdminWebsocket.connect({
      url: new URL(`ws://localhost:${port}`),
      defaultTimeout: 999999999
    });

    const tokenResp = await adminConn.issueAppAuthenticationToken({
      installed_app_id: appId
    });

    return tokenResp.token.toString();
  }

  /**
   * Connects to the Holochain client
   */
  async function connectClient(): Promise<void> {
    client = await AppWebsocket.connect();
    isConnected = true;
  }

  /**
   * Calls a zome function
   */
  async function callZome(
    zomeName: string,
    fnName: string,
    payload: unknown,
    capSecret: Uint8Array | null = null,
    roleName: string = 'hrea_combined'
  ): Promise<unknown> {
    if (!client) {
      throw new Error('Client not connected');
    }

    return await client.callZome({
      cap_secret: capSecret,
      role_name: roleName,
      zome_name: zomeName,
      fn_name: fnName,
      payload: payload
    });
  }

  /**
   * Creates a new intent in the hREA system
   */
  async function createIntent(intent: HREAIntent): Promise<HREAIntent> {
    return (await callZome('economic_events', 'create_intent', intent)) as HREAIntent;
  }

  /**
   * Converts an intent to a proposal
   */
  async function convertIntentToProposal(intent: HREAIntent): Promise<HREAProposal> {
    const proposal: HREAProposal = {
      ...intent,
      proposalStatus: 'draft'
    };

    return (await callZome('economic_events', 'create_proposal', proposal)) as HREAProposal;
  }

  /**
   * Classifies a resource for economic tracking
   */
  async function classifyResource(resourceName: string, category: string): Promise<string> {
    return (await callZome('economic_resources', 'classify_resource', {
      resourceName,
      category
    })) as string;
  }

  return {
    // State (with getters)
    get adminPort() {
      return port;
    },
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
    connectAndAuthorizeCells,
    generateAppAuthToken,
    connectClient,
    callZome,
    createIntent,
    convertIntentToProposal,
    classifyResource
  };
}

// Create a singleton instance
const hreaService = createHREAService();
export default hreaService;
