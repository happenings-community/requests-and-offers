import { AppWebsocket, type AppInfoResponse } from '@holochain/client';
import { Effect as E, Context, Layer, pipe, Ref } from 'effect';
import { Schema } from 'effect';
import {
  ConnectionError,
  ZomeCallError,
  SchemaDecodeError,
  type AnyHolochainClientError
} from '$lib/errors/holochain-client.errors';

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
 * Implementation of the HolochainClient service
 */
const createHolochainClientService = (): E.Effect<HolochainClientService, never> =>
  E.gen(function* () {
    const appId = 'requests_and_offers';
    const clientRef = yield* Ref.make<AppWebsocket | null>(null);

    const connectClientEffect = (): E.Effect<AppWebsocket, ConnectionError> =>
      pipe(
        E.tryPromise({
          try: () => AppWebsocket.connect(),
          catch: (error) =>
            ConnectionError.create('Failed to connect to Holochain conductor', error)
        }),
        E.tap((client) => Ref.set(clientRef, client))
      );

    const getAppInfoEffect = (): E.Effect<AppInfoResponse, AnyHolochainClientError> =>
      pipe(
        Ref.get(clientRef),
        E.flatMap((client): E.Effect<AppInfoResponse, AnyHolochainClientError> => {
          if (!client) {
            return E.fail(ConnectionError.create('Client not connected'));
          }
          return E.tryPromise({
            try: () => client.appInfo(),
            catch: (error) => ConnectionError.create('Failed to get app info', error)
          });
        })
      );

    const callZomeRawEffect = (
      zomeName: ZomeName,
      fnName: string,
      payload: unknown,
      capSecret: Uint8Array | null = null,
      roleName: RoleName = 'requests_and_offers'
    ): E.Effect<unknown, AnyHolochainClientError> =>
      pipe(
        Ref.get(clientRef),
        E.flatMap((client): E.Effect<unknown, AnyHolochainClientError> => {
          if (!client) {
            return E.fail(ConnectionError.create('Client not connected'));
          }

          return E.tryPromise({
            try: () =>
              client.callZome({
                cap_secret: capSecret,
                zome_name: zomeName,
                fn_name: fnName,
                payload,
                role_name: roleName
              }),
            catch: (error) => ZomeCallError.create(zomeName, fnName, error)
          });
        })
      );

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
      pipe(
        Ref.get(clientRef),
        E.map((client) => client !== null)
      );

    const getClientEffect = (): E.Effect<AppWebsocket | null, never> => Ref.get(clientRef);

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
