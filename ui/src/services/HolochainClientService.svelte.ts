import { AppWebsocket, type AppInfoResponse } from '@holochain/client';

export type ZomeName = 'users_organizations' | 'administration' | 'misc';

class HolochainClientService {
  appId = 'requests_and_offers';
  client: AppWebsocket | null = $state(null);
  isConnected = $state(false);

  /**
   * Connects the client to the Host backend.
   */
  async connectClient() {
    this.client = await AppWebsocket.connect();
    this.isConnected = true;
  }

  /**
   * Retrieves application information from the Holochain client.
   * @returns {Promise<AppInfoResponse>} - The application information.
   */
  async getAppInfo(): Promise<AppInfoResponse> {
    if (!this.client) {
      throw new Error('Client not connected');
    }
    return await this.client.appInfo();
  }

  /**
   * Calls a zome function on the Holochain client.
   * @param {string} zomeName - The name of the zome.
   * @param {string} fnName - The name of the function within the zome.
   * @param {unknown} payload - The payload to send with the function call.
   * @param {string} roleName - The name of the role to call the function on. Defaults to 'requests_and_offers'.
   * @returns {Promise<unknown>} - The result of the zome function call.
   */
  async callZome(
    zomeName: ZomeName,
    fnName: string,
    payload: unknown,
    capSecret: Uint8Array | null = null,
    roleName: string = 'requests_and_offers'
  ): Promise<unknown> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      const record = await this.client.callZome({
        cap_secret: capSecret,
        zome_name: zomeName,
        role_name: roleName,
        fn_name: fnName,
        payload: payload
      });

      return record;
    } catch (error) {
      console.error(error);
    }
  }
}

const hc = new HolochainClientService();
export default hc;
