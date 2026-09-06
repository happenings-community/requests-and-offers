import type { ActionHash, Record } from '@holochain/client';
import { Effect as E, pipe } from 'effect';
import {
  ExchangesServiceTag,
  ExchangesServiceLive,
  type ExchangesService
} from '$lib/services/zomes/exchanges.service';
import { HolochainClientServiceLive } from '$lib/services/HolochainClientService.svelte';
import { ExchangeError } from '$lib/errors/exchanges.errors';
import { decodeRecord } from '$lib/utils';
import type {
  AgreementInDHT,
  CancellationInDHT,
  CreateAgreementInput,
  ExchangeReadModel,
  InterestInDHT,
  ListingType,
  ResponseInDHT,
  ReviewInDHT,
  ReviewInput
} from '$lib/types/holochain';
import type { UIExchange, UIInterest } from '$lib/types/ui';

// ============================================================================
// TYPES
// ============================================================================

export type ExchangesStore = {
  readonly exchanges: UIExchange[];
  readonly loading: boolean;
  readonly error: string | null;

  loadMyExchanges: () => E.Effect<UIExchange[], ExchangeError>;
  getExchange: (agreement: ActionHash) => E.Effect<UIExchange, ExchangeError>;
  getExchangesForListing: (listing: ActionHash) => E.Effect<UIExchange[], ExchangeError>;
  getInterestsForListing: (listing: ActionHash) => E.Effect<UIInterest[], ExchangeError>;
  getMyInterests: () => E.Effect<UIInterest[], ExchangeError>;
  createInterest: (listing: ActionHash, listingType: ListingType) => E.Effect<UIInterest, ExchangeError>;
  withdrawInterest: (interest: ActionHash) => E.Effect<void, ExchangeError>;
  createAgreement: (input: CreateAgreementInput) => E.Effect<UIExchange, ExchangeError>;
  respond: (agreement: ActionHash, accepted: boolean, note: string) => E.Effect<UIExchange, ExchangeError>;
  complete: (agreement: ActionHash) => E.Effect<UIExchange, ExchangeError>;
  review: (agreement: ActionHash, review: ReviewInput) => E.Effect<UIExchange, ExchangeError>;
  cancel: (agreement: ActionHash, note: string) => E.Effect<UIExchange, ExchangeError>;
};

// ============================================================================
// DECODING
// ============================================================================

const timed = (record: Record) => ({
  created_at: Math.floor(Number(record.signed_action.hashed.content.timestamp) / 1000)
});

const hashOf = (record: Record): ActionHash => record.signed_action.hashed.hash;

const entryWithTime = <T>(record: Record | null): (T & { created_at: number }) | undefined =>
  record ? { ...decodeRecord<T>(record), ...timed(record) } : undefined;

const toUIInterest = (record: Record): UIInterest => ({
  ...decodeRecord<InterestInDHT>(record),
  ...timed(record),
  interest_hash: hashOf(record)
});

const toUIExchange = (model: ExchangeReadModel): UIExchange => ({
  ...timed(model.agreement),
  agreement_hash: hashOf(model.agreement),
  agreement: decodeRecord<AgreementInDHT>(model.agreement),
  status: model.status,
  response: entryWithTime<ResponseInDHT>(model.response),
  provider_done: model.provider_completion ? timed(model.provider_completion) : undefined,
  receiver_done: model.receiver_completion ? timed(model.receiver_completion) : undefined,
  provider_review: entryWithTime<ReviewInDHT>(model.provider_review),
  receiver_review: entryWithTime<ReviewInDHT>(model.receiver_review),
  cancellation: entryWithTime<CancellationInDHT>(model.cancellation)
});

// ============================================================================
// STORE
// ============================================================================

export const createExchangesStore = (): E.Effect<ExchangesStore, never, ExchangesServiceTag> =>
  E.gen(function* () {
    const service: ExchangesService = yield* ExchangesServiceTag;

    let exchanges = $state<UIExchange[]>([]);
    let loading = $state(false);
    let error = $state<string | null>(null);

    /** Runs an effect with the store's loading and error flags around it. */
    const tracked = <A>(effect: E.Effect<A, ExchangeError>): E.Effect<A, ExchangeError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => effect),
        E.tapError((e) => E.sync(() => (error = e.message))),
        E.ensuring(E.sync(() => (loading = false)))
      );

    /** Replaces an exchange in the list by agreement hash, or appends it. */
    const upsert = (exchange: UIExchange) => {
      const key = exchange.agreement_hash.toString();
      const i = exchanges.findIndex((x) => x.agreement_hash.toString() === key);
      if (i >= 0) exchanges[i] = exchange;
      else exchanges.push(exchange);
      return exchange;
    };

    const refetch = (agreement: ActionHash) =>
      pipe(service.getExchange(agreement), E.map(toUIExchange), E.map(upsert));

    const loadMyExchanges = () =>
      tracked(
        pipe(
          service.getMyExchanges(),
          E.map((models) => models.map(toUIExchange)),
          E.map((list) => {
            exchanges = list;
            return list;
          })
        )
      );

    const getExchange = (agreement: ActionHash) => tracked(refetch(agreement));

    const getExchangesForListing = (listing: ActionHash) =>
      tracked(pipe(service.getExchangesForListing(listing), E.map((m) => m.map(toUIExchange))));

    const getInterestsForListing = (listing: ActionHash) =>
      tracked(pipe(service.getInterestsForListing(listing), E.map((r) => r.map(toUIInterest))));

    const getMyInterests = () =>
      tracked(pipe(service.getMyInterests(), E.map((r) => r.map(toUIInterest))));

    const createInterest = (listing: ActionHash, listingType: ListingType) =>
      tracked(pipe(service.createInterest(listing, listingType), E.map(toUIInterest)));

    const withdrawInterest = (interest: ActionHash) =>
      tracked(pipe(service.withdrawInterest(interest), E.asVoid));

    const createAgreement = (input: CreateAgreementInput) =>
      tracked(
        pipe(
          service.createAgreement(input),
          E.flatMap((record) => refetch(hashOf(record)))
        )
      );

    const afterWrite = (agreement: ActionHash, write: E.Effect<Record, ExchangeError>) =>
      tracked(pipe(write, E.flatMap(() => refetch(agreement))));

    const respond = (agreement: ActionHash, accepted: boolean, note: string) =>
      afterWrite(agreement, service.respondToAgreement(agreement, accepted, note));

    const complete = (agreement: ActionHash) =>
      afterWrite(agreement, service.completeAgreement(agreement));

    const review = (agreement: ActionHash, input: ReviewInput) =>
      afterWrite(agreement, service.reviewAgreement(agreement, input));

    const cancel = (agreement: ActionHash, note: string) =>
      afterWrite(agreement, service.cancelAgreement(agreement, note));

    return {
      get exchanges() {
        return exchanges;
      },
      get loading() {
        return loading;
      },
      get error() {
        return error;
      },
      loadMyExchanges,
      getExchange,
      getExchangesForListing,
      getInterestsForListing,
      getMyInterests,
      createInterest,
      withdrawInterest,
      createAgreement,
      respond,
      complete,
      review,
      cancel
    };
  });

// ============================================================================
// STORE INSTANCE
// ============================================================================

const exchangesStore: ExchangesStore = pipe(
  createExchangesStore(),
  E.provide(ExchangesServiceLive),
  E.provide(HolochainClientServiceLive),
  E.runSync
);

export default exchangesStore;
