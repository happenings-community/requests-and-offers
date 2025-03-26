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

class HREAService {
  private adminPort: number | null = null;
  private appId = 'requests_and_offers';
  private client: AppWebsocket | null = null;
  private isConnected = false;

  constructor(adminPort?: number) {
    this.adminPort = adminPort || null;
  }

  /**
   * Connects to the admin websocket and authorizes cells
   */
  async connectAndAuthorizeCells(): Promise<void> {
    if (!this.adminPort) {
      console.log('No admin port provided');
      return;
    }

    try {
      const adminWebsocket = await AdminWebsocket.connect({
        url: new URL(`ws://localhost:${this.adminPort}`)
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
  async generateAppAuthToken(): Promise<string> {
    if (!this.adminPort) {
      throw new Error('No admin port provided');
    }

    const adminConn = await AdminWebsocket.connect({
      url: new URL(`ws://localhost:${this.adminPort}`),
      defaultTimeout: 999999999
    });

    const tokenResp = await adminConn.issueAppAuthenticationToken({
      installed_app_id: this.appId
    });

    return tokenResp.token.toString();
  }

  /**
   * Connects to the Holochain client
   */
  async connectClient() {
    this.client = await AppWebsocket.connect();
    this.isConnected = true;
  }

  /**
   * Calls a zome function
   */
  async callZome(
    zomeName: string,
    fnName: string,
    payload: unknown,
    capSecret: Uint8Array | null = null,
    roleName: string = 'hrea_combined'
  ): Promise<unknown> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    return await this.client.callZome({
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
  async createIntent(intent: HREAIntent): Promise<HREAIntent> {
    return (await this.callZome('economic_events', 'create_intent', intent)) as HREAIntent;
  }

  /**
   * Converts an intent to a proposal
   */
  async convertIntentToProposal(intent: HREAIntent): Promise<HREAProposal> {
    const proposal: HREAProposal = {
      ...intent,
      proposalStatus: 'draft'
    };

    return (await this.callZome('economic_events', 'create_proposal', proposal)) as HREAProposal;
  }

  /**
   * Classifies a resource for economic tracking
   */
  async classifyResource(resourceName: string, category: string): Promise<string> {
    return (await this.callZome('economic_resources', 'classify_resource', {
      resourceName,
      category
    })) as string;
  }
}

// Create a singleton instance
const hreaService = new HREAService();
export default hreaService;
