import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { Effect as E, Layer, Context, pipe, Schema } from 'effect';
import { HreaError } from '$lib/errors';
import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';
import { SchemaLink } from '@apollo/client/link/schema';
import { createHolochainSchema } from '@valueflows/vf-graphql-holochain';
import { setClient } from 'svelte-apollo';
import { AgentSchema } from '$lib/schemas/hrea.schemas';
import type { Agent } from '$lib/types/hrea';

// --- Service Interface ---

export interface HreaService {
  readonly initialize: () => E.Effect<void, HreaError>;
  readonly createPerson: (params: { name: string; note?: string }) => E.Effect<Agent, HreaError>;
}

export class HreaServiceTag extends Context.Tag('HreaService')<HreaServiceTag, HreaService>() {}

export const HreaServiceLive: Layer.Layer<HreaServiceTag, never, HolochainClientServiceTag> =
  Layer.effect(
    HreaServiceTag,
    E.gen(function* ($) {
      const holochainClient = yield* $(HolochainClientServiceTag);
      let apolloClient: ApolloClient<any>;

      const initialize = (): E.Effect<void, HreaError> =>
        pipe(
          holochainClient.connectClientEffect(),
          E.map((client) => {
            const schema = createHolochainSchema({
              appWebSocket: client,
              roleName: 'hrea'
            });

            apolloClient = new ApolloClient({
              cache: new InMemoryCache(),
              link: new SchemaLink({ schema }),
              defaultOptions: {
                query: {
                  fetchPolicy: 'cache-first'
                },
                mutate: {
                  fetchPolicy: 'no-cache'
                }
              }
            });
            setClient(apolloClient);
          }),
          E.mapError((error) => HreaError.fromError(error, 'Failed to initialize Apollo Client'))
        );

      const createPerson = (params: { name: string; note?: string }) =>
        pipe(
          E.tryPromise({
            try: () =>
              apolloClient.mutate({
                mutation: gql`
                  mutation CreatePerson($person: AgentCreateParams!) {
                    createPerson(person: $person) {
                      agent {
                        id
                        name
                        note
                      }
                    }
                  }
                `,
                variables: {
                  person: {
                    name: params.name,
                    note: params.note
                  }
                }
              }),
            catch: (error) => HreaError.fromError(error, 'Failed to create person agent')
          }),
          E.flatMap((result) => Schema.decodeUnknown(AgentSchema)(result.data.createPerson.agent)),
          E.mapError((error) => HreaError.fromError(error, 'Failed to parse created agent data'))
        );

      return HreaServiceTag.of({
        initialize,
        createPerson
      });
    })
  );
