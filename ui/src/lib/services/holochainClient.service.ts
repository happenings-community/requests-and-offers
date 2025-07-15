import { AppWebsocket, type AppInfoResponse } from '@holochain/client';
import { Effect as E, Context, Layer, pipe } from 'effect';
import { Schema } from 'effect';
import {
  HolochainClientError,
  ConnectionError,
  ZomeCallError,
  SchemaDecodeError,
  HOLOCHAIN_CLIENT_CONTEXTS
} from '$lib/errors';
import holochainClientService from './HolochainClientService.svelte';

export type ZomeName =
  | 'users_organizations'
  | 'requests'
  | 'offers'
  | 'administration'
  | 'service_types'
  | 'mediums_of_exchange'
  | 'misc'
  | 'hrea_economic_event'
  | 'hrea_observation';

export type RoleName = 'requests_and_offers' | 'hrea';

/**
 * Pure Effect-based HolochainClient service interface
 */
export interface HolochainClientService {
  readonly appId: string;
  readonly connectClientEffect: () => E.Effect<AppWebsocket, HolochainClientError>;
  readonly getAppInfoEffect: () => E.Effect<AppInfoResponse, HolochainClientError>;
  readonly callZomeEffect: <A>(
    zomeName: ZomeName,
    fnName: string,
    payload: unknown,
    outputSchema: Schema.Schema<A>,
    capSecret?: Uint8Array | undefined,
    roleName?: RoleName
  ) => E.Effect<A, HolochainClientError>;
  readonly callZomeRawEffect: (
    zomeName: ZomeName,
    fnName: string,
    payload: unknown,
    capSecret?: Uint8Array | undefined,
    roleName?: RoleName
  ) => E.Effect<unknown, HolochainClientError>;
  readonly isConnectedEffect: () => E.Effect<boolean, never>;
  readonly getClientEffect: () => E.Effect<AppWebsocket | null, never>;
}

/**
 * Context tag for HolochainClient service
 */
export class HolochainClientServiceTag extends Context.Tag('HolochainClientService')<
  HolochainClientServiceTag,
  HolochainClientService
>() {}

/**
 * Implementation of the HolochainClient service that uses the shared Svelte client
 */
const createHolochainClientService = (): E.Effect<HolochainClientService, never> =>
  E.gen(function* () {
    const appId = 'requests_and_offers';

    const connectClientEffect = (): E.Effect<AppWebsocket, ConnectionError> =>
      E.tryPromise({
        try: async () => {
          // Use the shared Svelte client connection
          if (!holochainClientService.client) {
            await holochainClientService.connectClient();
          }
          return holochainClientService.client!;
        },
        catch: (error) => HolochainClientError.fromError(error, HOLOCHAIN_CLIENT_CONTEXTS.CONNECT)
      });

    const getAppInfoEffect = (): E.Effect<AppInfoResponse, HolochainClientError> =>
      E.tryPromise({
        try: async () => {
          // Use the shared Svelte client
          if (!holochainClientService.client) {
            throw new Error('Client not connected');
          }
          return await holochainClientService.getAppInfo();
        },
        catch: (error) =>
          HolochainClientError.fromError(error, HOLOCHAIN_CLIENT_CONTEXTS.GET_DNA_INFO)
      });

    const callZomeRawEffect = (
      zomeName: ZomeName,
      fnName: string,
      payload: unknown,
      capSecret: Uint8Array | undefined = undefined,
      roleName: RoleName = 'requests_and_offers'
    ): E.Effect<unknown, HolochainClientError> =>
      E.tryPromise({
        try: async () => {
          // Use the shared Svelte client
          if (!holochainClientService.client) {
            throw new Error('Client not connected');
          }
          return await holochainClientService.callZome(
            zomeName,
            fnName,
            payload,
            capSecret,
            roleName
          );
        },
        catch: (error) =>
          HolochainClientError.fromError(
            error,
            HOLOCHAIN_CLIENT_CONTEXTS.CALL_ZOME,
            'call_zome',
            zomeName,
            fnName
          )
      });

    const callZomeEffect = <A>(
      zomeName: ZomeName,
      fnName: string,
      payload: unknown,
      outputSchema: Schema.Schema<A>,
      capSecret: Uint8Array | undefined = undefined,
      roleName: RoleName = 'requests_and_offers'
    ): E.Effect<A, HolochainClientError> =>
      pipe(
        callZomeRawEffect(zomeName, fnName, payload, capSecret, roleName),
        E.flatMap(
          (result): E.Effect<A, HolochainClientError> =>
            E.try({
              try: () => Schema.decodeUnknownSync(outputSchema)(result),
              catch: (parseError) =>
                HolochainClientError.fromError(
                  parseError,
                  HOLOCHAIN_CLIENT_CONTEXTS.VALIDATE_RESPONSE
                )
            })
        )
      );

    const isConnectedEffect = (): E.Effect<boolean, never> =>
      E.succeed(holochainClientService.isConnected);

    const getClientEffect = (): E.Effect<AppWebsocket | null, never> =>
      E.succeed(holochainClientService.client);

    return {
      appId,
      connectClientEffect,
      getAppInfoEffect,
      callZomeEffect,
      callZomeRawEffect,
      isConnectedEffect,
      getClientEffect
    };
  });

/**
 * Live layer for HolochainClient service
 */
export const HolochainClientLive: Layer.Layer<HolochainClientServiceTag, never, never> =
  Layer.effect(HolochainClientServiceTag, createHolochainClientService());
