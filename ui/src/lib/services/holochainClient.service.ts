import { AppWebsocket, type AppInfoResponse } from '@holochain/client';
import { Effect as E, Context, Layer, pipe } from 'effect';
import { Schema } from 'effect';
import {
  ConnectionError,
  ZomeCallError,
  SchemaDecodeError,
  type AnyHolochainClientError
} from '$lib/errors/holochain-client.errors';
import holochainClientService from './HolochainClientService.svelte';

export type ZomeName =
  | 'users_organizations'
  | 'requests'
  | 'offers'
  | 'administration'
  | 'service_types'
  | 'misc';

export type RoleName = 'requests_and_offers' | 'hrea_combined';

/**
 * Pure Effect-based HolochainClient service interface
 */
export interface HolochainClientService {
  readonly appId: string;
  readonly connectClientEffect: () => E.Effect<AppWebsocket, ConnectionError>;
  readonly getAppInfoEffect: () => E.Effect<AppInfoResponse, AnyHolochainClientError>;
  readonly callZomeEffect: <A>(
    zomeName: ZomeName,
    fnName: string,
    payload: unknown,
    outputSchema: Schema.Schema<A>,
    capSecret?: Uint8Array | null,
    roleName?: RoleName
  ) => E.Effect<A, AnyHolochainClientError>;
  readonly callZomeRawEffect: (
    zomeName: ZomeName,
    fnName: string,
    payload: unknown,
    capSecret?: Uint8Array | null,
    roleName?: RoleName
  ) => E.Effect<unknown, AnyHolochainClientError>;
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
        catch: (error) => ConnectionError.create('Failed to connect to Holochain conductor', error)
      });

    const getAppInfoEffect = (): E.Effect<AppInfoResponse, AnyHolochainClientError> =>
      E.tryPromise({
        try: async () => {
          // Use the shared Svelte client
          if (!holochainClientService.client) {
            throw new Error('Client not connected');
          }
          return await holochainClientService.getAppInfo();
        },
        catch: (error) => ConnectionError.create('Failed to get app info', error)
      });

    const callZomeRawEffect = (
      zomeName: ZomeName,
      fnName: string,
      payload: unknown,
      capSecret: Uint8Array | null = null,
      roleName: RoleName = 'requests_and_offers'
    ): E.Effect<unknown, AnyHolochainClientError> =>
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
        catch: (error) => ZomeCallError.create(zomeName, fnName, error)
      });

    const callZomeEffect = <A>(
      zomeName: ZomeName,
      fnName: string,
      payload: unknown,
      outputSchema: Schema.Schema<A>,
      capSecret: Uint8Array | null = null,
      roleName: RoleName = 'requests_and_offers'
    ): E.Effect<A, AnyHolochainClientError> =>
      pipe(
        callZomeRawEffect(zomeName, fnName, payload, capSecret, roleName),
        E.flatMap(
          (result): E.Effect<A, AnyHolochainClientError> =>
            E.try({
              try: () => Schema.decodeUnknownSync(outputSchema)(result),
              catch: (parseError) =>
                SchemaDecodeError.create(
                  `Failed to decode zome response: ${String(parseError)}`,
                  'Schema',
                  parseError
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
