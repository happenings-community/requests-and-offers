import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect as E, Layer, Exit, Cause } from 'effect';
import type { Record as HcRecord } from '@holochain/client';
import {
  ExchangesServiceLive,
  ExchangesServiceTag,
  type ExchangesService
} from '$lib/services/zomes/exchanges.service';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { ExchangeError } from '$lib/errors/exchanges.errors';
import type { CreateAgreementInput } from '$lib/types/holochain';

/**
 * The service refuses a write the integrity zome would refuse, before the zome
 * call. Each test asserts both halves: the member gets a message they can act
 * on, and `callZome` was never reached.
 */

const hash = (n: number) => new Uint8Array([n, n, n, n]);

const createMockHolochainClientService = () => ({
  appId: 'test-app',
  client: null,
  isConnected: true,
  isConnecting: false,
  weaveClient: null,
  profilesClient: null,
  isWeaveContext: false,
  connectClient: vi.fn(),
  waitForConnection: vi.fn(() => Promise.resolve()),
  getAppInfo: vi.fn(),
  getPeerMetaInfo: vi.fn(() => Promise.resolve({})),
  callZome: vi.fn(() => Promise.resolve({} as HcRecord)),
  verifyConnection: vi.fn(),
  getNetworkSeed: vi.fn(() => Promise.resolve('test-network-seed')),
  getNetworkInfo: vi.fn(() => Promise.resolve({})),
  getNetworkPeers: vi.fn(() => Promise.resolve([])),
  isGroupProgenitor: vi.fn(() => Promise.resolve(false)),
  getNetworkPeerStatus: vi.fn()
});

const valid: CreateAgreementInput = {
  listing: hash(1),
  listing_type: 'Offer',
  interest: hash(2),
  primary: {
    direction: 'Provide',
    resource_conforms_to: 'Gardening',
    resource_kind: 'Service',
    quantity: { value: 2, unit: 'hours' }
  },
  reciprocal: {
    direction: 'Receive',
    resource_conforms_to: 'CAD',
    resource_kind: 'Currency',
    quantity: { value: 60, unit: 'CAD' }
  },
  medium: 'CAD',
  terms: 'Saturday morning',
  delivery_timeframe: 'Within 2 weeks'
};

describe('exchanges service validation', () => {
  let client: ReturnType<typeof createMockHolochainClientService>;
  let service: ExchangesService;

  /** The message of a refused write. */
  const refusal = async <A>(effect: E.Effect<A, ExchangeError>): Promise<string> => {
    const exit = await E.runPromiseExit(effect);
    if (Exit.isSuccess(exit)) throw new Error('expected the write to be refused');
    const failure = Cause.failureOption(exit.cause);
    if (failure._tag === 'None') throw new Error('expected a typed failure');
    return failure.value.message;
  };

  beforeEach(async () => {
    client = createMockHolochainClientService();
    service = await E.runPromise(
      E.provide(
        ExchangesServiceTag,
        ExchangesServiceLive.pipe(
          Layer.provide(Layer.succeed(HolochainClientServiceTag, client as never))
        )
      )
    );
  });

  it('calls the zome for a valid agreement', async () => {
    await E.runPromise(service.createAgreement(valid));
    expect(client.callZome).toHaveBeenCalledWith('exchanges', 'create_agreement', valid);
  });

  it('refuses an agreement whose primary term is not the service provided', async () => {
    const message = await refusal(
      service.createAgreement({ ...valid, primary: { ...valid.reciprocal, direction: 'Provide' } })
    );
    expect(message).toContain('primary term is the service provided');
    expect(client.callZome).not.toHaveBeenCalled();
  });

  it('refuses an agreement whose reciprocal term flows the wrong way', async () => {
    const message = await refusal(
      service.createAgreement({
        ...valid,
        reciprocal: { ...valid.reciprocal, direction: 'Provide' }
      })
    );
    expect(message).toContain('what the provider receives');
    expect(client.callZome).not.toHaveBeenCalled();
  });

  it('refuses an agreement that names no medium', async () => {
    const message = await refusal(service.createAgreement({ ...valid, medium: '  ' }));
    expect(message).toContain('how this exchange is settled');
    expect(client.callZome).not.toHaveBeenCalled();
  });

  it('refuses a quantity of zero', async () => {
    const message = await refusal(
      service.createAgreement({
        ...valid,
        primary: { ...valid.primary, quantity: { value: 0, unit: 'hours' } }
      })
    );
    expect(message).toContain('greater than zero');
    expect(client.callZome).not.toHaveBeenCalled();
  });

  it('refuses a gift term that carries a quantity', async () => {
    const message = await refusal(
      service.createAgreement({
        ...valid,
        reciprocal: {
          direction: 'Receive',
          resource_conforms_to: '',
          resource_kind: 'Gift',
          quantity: { value: 1, unit: 'hours' }
        }
      })
    );
    expect(message).toContain('carries no quantity');
    expect(client.callZome).not.toHaveBeenCalled();
  });

  it('calls the zome for a rating inside the range', async () => {
    await E.runPromise(
      service.reviewAgreement(hash(10), { rating: 4, on_time: true, as_agreed: true, comment: '' })
    );
    expect(client.callZome).toHaveBeenCalledTimes(1);
  });

  it('refuses a rating above what the zome accepts', async () => {
    const message = await refusal(
      service.reviewAgreement(hash(10), { rating: 6, on_time: true, as_agreed: true, comment: '' })
    );
    expect(message).toContain('one to five stars');
    expect(client.callZome).not.toHaveBeenCalled();
  });

  it('refuses an unrated review', async () => {
    const message = await refusal(
      service.reviewAgreement(hash(10), { rating: 0, on_time: true, as_agreed: true, comment: '' })
    );
    expect(message).toContain('one to five stars');
    expect(client.callZome).not.toHaveBeenCalled();
  });

  // The two write paths that carry a payload beyond a bare hash and were not
  // decoded until the schemas were wired in. Each pair pins both directions:
  // the valid call reaches the zome, the malformed one never leaves the browser.

  it('calls the zome for a well-formed response to an agreement', async () => {
    await E.runPromise(service.respondToAgreement(hash(1), true, 'Yes.'));
    expect(client.callZome).toHaveBeenCalledWith('exchanges', 'respond_to_agreement', {
      agreement: hash(1),
      accepted: true,
      note: 'Yes.'
    });
  });

  it('refuses a response whose acceptance is not a boolean', async () => {
    const message = await refusal(
      service.respondToAgreement(hash(1), 'yes' as unknown as boolean, 'Yes.')
    );
    expect(message.length).toBeGreaterThan(0);
    expect(client.callZome).not.toHaveBeenCalled();
  });

  it('calls the zome for a well-formed cancellation', async () => {
    await E.runPromise(service.cancelAgreement(hash(1), 'Changed my mind.'));
    expect(client.callZome).toHaveBeenCalledWith('exchanges', 'cancel_agreement', {
      agreement: hash(1),
      note: 'Changed my mind.'
    });
  });

  it('refuses a cancellation whose note is not a string', async () => {
    const message = await refusal(
      service.cancelAgreement(hash(1), 42 as unknown as string)
    );
    expect(message.length).toBeGreaterThan(0);
    expect(client.callZome).not.toHaveBeenCalled();
  });

  it('refuses an interest on a listing type the zome does not know', async () => {
    const message = await refusal(
      service.createInterest(hash(1), 'Barter' as unknown as 'Offer')
    );
    expect(message.length).toBeGreaterThan(0);
    expect(client.callZome).not.toHaveBeenCalled();
  });
});
