// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

/**
 * Every zome payload leaves the page as plain data.
 *
 * In the desktop app the zome call is signed in the Electron main process, so the request
 * crosses IPC, which structured-clones it, and a Svelte `$state` proxy cannot be cloned:
 * the propose page failed with "An object could not be cloned" because its delivery
 * timeframe was a `$derived` read of `$state`. The web build signs inside the page through
 * msgpack, which accepts a proxy, so nothing else in the suite sees this.
 *
 * Here the conductor connection is a stand-in, and the assertion is the one Electron makes:
 * what reaches the client's `callZome` must survive `structuredClone`.
 */

vi.mock('@holochain/client', async () => {
  const actual = await vi.importActual<typeof import('@holochain/client')>('@holochain/client');
  return {
    SignalType: actual.SignalType,
    AppWebsocket: { connect: vi.fn() },
    AdminWebsocket: { connect: vi.fn() }
  };
});

type Service = typeof import('../../../src/lib/services/HolochainClientService.svelte').default;

type SentRequest = { payload: unknown };

const fakeClient = () => ({
  appInfo: vi.fn(),
  callZome: vi.fn<(request: SentRequest) => Promise<null>>(async () => null),
  on: vi.fn(() => () => {})
});

let service: Service;
let connect: Mock;

beforeEach(async () => {
  vi.resetModules();
  const client = await import('@holochain/client');
  connect = client.AppWebsocket.connect as unknown as Mock;
  connect.mockReset();
  service = (await import('../../../src/lib/services/HolochainClientService.svelte')).default;
}, 60_000);

/** The proposal the propose page writes up: a listing and a chosen timeframe, both state. */
const stateProposal = () => {
  const listing = $state({ timeframe: { kind: 'Ongoing' }, amount: { value: 3, unit: 'hours' } });
  const chosen = $state<{ kind: string; days?: number[] } | null>({ kind: 'Days', days: [1, 2] });
  const timeframe = $derived(chosen ?? listing.timeframe);
  const hash = new Uint8Array([132, 41, 36, 7]);
  return {
    get payload() {
      return { listing_hash: hash, delivery_timeframe: timeframe, amount: listing.amount };
    },
    /** An edit made after the call, as a form still bound to the listing would make. */
    edit() {
      listing.amount.value = 9;
    }
  };
};

describe('zome payloads leaving the page', () => {
  it('a $state proxy cannot be structured-cloned, which is the Electron failure', () => {
    const proposal = stateProposal();
    expect(() => structuredClone(proposal.payload)).toThrow();
  });

  it('reaches the client as structured-cloneable plain data', async () => {
    const client = fakeClient();
    connect.mockResolvedValue(client);
    await service.connectClient();

    const proposal = stateProposal();
    await service.callZome('exchanges', 'create_agreement', proposal.payload);

    const request: SentRequest = client.callZome.mock.calls[0][0];
    expect(() => structuredClone(request)).not.toThrow();
    expect(request.payload).toEqual({
      listing_hash: new Uint8Array([132, 41, 36, 7]),
      delivery_timeframe: { kind: 'Days', days: [1, 2] },
      amount: { value: 3, unit: 'hours' }
    });
  });

  it('is a copy taken at call time, so a later state change does not reach it', async () => {
    const client = fakeClient();
    connect.mockResolvedValue(client);
    await service.connectClient();

    const proposal = stateProposal();
    await service.callZome('exchanges', 'create_agreement', proposal.payload);
    proposal.edit();

    const request = client.callZome.mock.calls[0][0] as { payload: { amount: unknown } };
    expect(request.payload.amount).toEqual({ value: 3, unit: 'hours' });
  });

  it('passes a payload that is already plain through unchanged', async () => {
    const client = fakeClient();
    connect.mockResolvedValue(client);
    await service.connectClient();

    await service.callZome('misc', 'ping', null);
    await service.callZome('users_organizations', 'get_user', new Uint8Array([1, 2, 3]));

    expect(client.callZome.mock.calls[0][0].payload).toBeNull();
    expect(client.callZome.mock.calls[1][0].payload).toEqual(new Uint8Array([1, 2, 3]));
  });
});
