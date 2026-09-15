import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { Effect as E, Layer, Context } from 'effect';
import { ExchangeError } from '$lib/errors/exchanges.errors';
import { EXCHANGE_CONTEXTS } from '$lib/errors/error-contexts';
import type {
  CreateAgreementInput,
  ExchangeReadModel,
  ListingType,
  ReviewInput
} from '$lib/types/holochain';
import { wrapZomeCallWithErrorFactory } from '$lib/utils/zome-helpers';

export { ExchangeError };

// --- Service Interface ---

export interface ExchangesService {
  readonly createInterest: (
    listing: ActionHash,
    listingType: ListingType
  ) => E.Effect<Record, ExchangeError>;
  readonly withdrawInterest: (interest: ActionHash) => E.Effect<ActionHash, ExchangeError>;
  readonly getInterestsForListing: (listing: ActionHash) => E.Effect<Record[], ExchangeError>;
  readonly getMyInterests: () => E.Effect<Record[], ExchangeError>;
  readonly createAgreement: (input: CreateAgreementInput) => E.Effect<Record, ExchangeError>;
  readonly respondToAgreement: (
    agreement: ActionHash,
    accepted: boolean,
    note: string
  ) => E.Effect<Record, ExchangeError>;
  readonly completeAgreement: (agreement: ActionHash) => E.Effect<Record, ExchangeError>;
  readonly reviewAgreement: (
    agreement: ActionHash,
    review: ReviewInput
  ) => E.Effect<Record, ExchangeError>;
  readonly cancelAgreement: (agreement: ActionHash, note: string) => E.Effect<Record, ExchangeError>;
  readonly getExchange: (agreement: ActionHash) => E.Effect<ExchangeReadModel, ExchangeError>;
  readonly getMyExchanges: () => E.Effect<ExchangeReadModel[], ExchangeError>;
  readonly getExchangesForListing: (
    listing: ActionHash
  ) => E.Effect<ExchangeReadModel[], ExchangeError>;
}

export class ExchangesServiceTag extends Context.Tag('ExchangesService')<
  ExchangesServiceTag,
  ExchangesService
>() {}

export const ExchangesServiceLive: Layer.Layer<
  ExchangesServiceTag,
  never,
  HolochainClientServiceTag
> = Layer.effect(
  ExchangesServiceTag,
  E.gen(function* () {
    const holochainClient = yield* HolochainClientServiceTag;

    const wrapZomeCall = <T>(
      fnName: string,
      payload: unknown,
      context: string
    ): E.Effect<T, ExchangeError> =>
      wrapZomeCallWithErrorFactory(
        holochainClient,
        'exchanges',
        fnName,
        payload,
        context,
        ExchangeError.fromError
      );

    const createInterest = (listing: ActionHash, listingType: ListingType) =>
      wrapZomeCall<Record>(
        'create_interest',
        { listing, listing_type: listingType },
        EXCHANGE_CONTEXTS.CREATE_INTEREST
      );

    const withdrawInterest = (interest: ActionHash) =>
      wrapZomeCall<ActionHash>('withdraw_interest', interest, EXCHANGE_CONTEXTS.WITHDRAW_INTEREST);

    const getInterestsForListing = (listing: ActionHash) =>
      wrapZomeCall<Record[]>('get_interests_for_listing', listing, EXCHANGE_CONTEXTS.GET_INTERESTS);

    const getMyInterests = () =>
      wrapZomeCall<Record[]>('get_my_interests', null, EXCHANGE_CONTEXTS.GET_INTERESTS);

    const createAgreement = (input: CreateAgreementInput) =>
      wrapZomeCall<Record>('create_agreement', input, EXCHANGE_CONTEXTS.CREATE_AGREEMENT);

    const respondToAgreement = (agreement: ActionHash, accepted: boolean, note: string) =>
      wrapZomeCall<Record>(
        'respond_to_agreement',
        { agreement, accepted, note },
        EXCHANGE_CONTEXTS.RESPOND
      );

    const completeAgreement = (agreement: ActionHash) =>
      wrapZomeCall<Record>('complete_agreement', agreement, EXCHANGE_CONTEXTS.COMPLETE);

    const reviewAgreement = (agreement: ActionHash, review: ReviewInput) =>
      wrapZomeCall<Record>('review_agreement', { agreement, ...review }, EXCHANGE_CONTEXTS.REVIEW);

    const cancelAgreement = (agreement: ActionHash, note: string) =>
      wrapZomeCall<Record>('cancel_agreement', { agreement, note }, EXCHANGE_CONTEXTS.CANCEL);

    const getExchange = (agreement: ActionHash) =>
      wrapZomeCall<ExchangeReadModel>('get_exchange', agreement, EXCHANGE_CONTEXTS.GET_EXCHANGE);

    const getMyExchanges = () =>
      wrapZomeCall<ExchangeReadModel[]>('get_my_exchanges', null, EXCHANGE_CONTEXTS.GET_MY_EXCHANGES);

    const getExchangesForListing = (listing: ActionHash) =>
      wrapZomeCall<ExchangeReadModel[]>(
        'get_exchanges_for_listing',
        listing,
        EXCHANGE_CONTEXTS.GET_LISTING_EXCHANGES
      );

    return ExchangesServiceTag.of({
      createInterest,
      withdrawInterest,
      getInterestsForListing,
      getMyInterests,
      createAgreement,
      respondToAgreement,
      completeAgreement,
      reviewAgreement,
      cancelAgreement,
      getExchange,
      getMyExchanges,
      getExchangesForListing
    });
  })
);
