import type {
  AppWebsocket,
  AppInfo,
  NonProvenanceCallZomeRequest,
  InstalledAppInfoStatus
} from '@holochain/client';
import { testUsers } from '../fixtures/users';
import { testOrganizations } from '../fixtures/organizations';

export class HolochainClientMock implements Partial<AppWebsocket> {
  isConnected = true;

  async appInfo(): Promise<AppInfo> {
    return {
      installed_app_id: 'requests_and_offers',
      agent_pub_key: new Uint8Array([1, 2, 3, 4]),
      cell_info: {},
      status: { disabled: { reason: 'never_started' } } as InstalledAppInfoStatus
    };
  }

  async callZome(request: NonProvenanceCallZomeRequest): Promise<unknown> {
    const { zome_name, fn_name, payload } = request;

    // Mock responses based on zome and function name
    switch (zome_name) {
      case 'users_organizations':
        return this.handleUsersOrganizationsZome(fn_name, payload as Record<string, unknown>);
      case 'administration':
        return this.handleAdministrationZome(fn_name, payload as Record<string, unknown>);
      case 'misc':
        return this.handleMiscZome(fn_name);
      default:
        throw new Error(`Unhandled zome: ${zome_name}`);
    }
  }

  private handleUsersOrganizationsZome(
    fnName: string,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    const mockActionHash = new Uint8Array([1, 2, 3, 4]);

    switch (fnName) {
      case 'get_all_users':
        return Promise.resolve(Object.values(testUsers));
      case 'get_all_organizations':
        return Promise.resolve(Object.values(testOrganizations));
      case 'get_organization_members':
        return Promise.resolve([]);
      case 'get_organization_coordinators':
        return Promise.resolve([]);
      case 'get_latest_organization_record':
        return Promise.resolve({
          signed_action: {
            hashed: {
              hash: mockActionHash,
              content: testOrganizations.main
            }
          }
        });
      case 'create_user':
        return Promise.resolve({
          signed_action: {
            hashed: {
              hash: mockActionHash,
              content: {
                name: payload.name,
                nickname: payload.nickname,
                email: payload.email,
                user_type: payload.user_type
              }
            }
          }
        });
      case 'update_user':
        return Promise.resolve({
          signed_action: {
            hashed: {
              hash: mockActionHash,
              content: {
                ...testUsers.regular,
                ...payload
              }
            }
          }
        });
      case 'create_organization':
        return Promise.resolve({
          signed_action: {
            hashed: {
              hash: mockActionHash,
              content: {
                name: payload.name,
                description: payload.description,
                email: payload.email,
                urls: payload.urls,
                location: payload.location
              }
            }
          }
        });
      case 'update_organization':
        return Promise.resolve({
          signed_action: {
            hashed: {
              hash: mockActionHash,
              content: {
                ...testOrganizations.main,
                ...payload
              }
            }
          }
        });
      case 'add_member':
      case 'remove_member':
      case 'add_coordinator':
      case 'remove_coordinator':
        return Promise.resolve(true);
      default:
        throw new Error(`Unhandled function: ${fnName}`);
    }
  }

  private handleAdministrationZome(
    fnName: string,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    const mockActionHash = new Uint8Array([1, 2, 3, 4]);

    switch (fnName) {
      case 'get_admin_status':
        return Promise.resolve(true);
      case 'get_accepted_entities':
        return Promise.resolve([
          {
            target: mockActionHash,
            author: mockActionHash
          }
        ]);
      case 'update_user_status':
      case 'update_organization_status':
        return Promise.resolve({
          signed_action: {
            hashed: {
              hash: mockActionHash,
              content: {
                status_type: payload.status_type,
                reason: payload.reason
              }
            }
          }
        });
      default:
        throw new Error(`Unhandled function: ${fnName}`);
    }
  }

  private handleMiscZome(fnName: string): Promise<unknown> {
    switch (fnName) {
      case 'ping':
        return Promise.resolve('pong');
      default:
        throw new Error(`Unhandled function: ${fnName}`);
    }
  }
}
