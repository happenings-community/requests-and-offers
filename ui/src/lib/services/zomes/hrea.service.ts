import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { Effect as E, Layer, Context, pipe, Schema } from 'effect';
import { HreaError } from '$lib/errors';
import { ApolloClient, InMemoryCache } from '@apollo/client/core';
import { SchemaLink } from '@apollo/client/link/schema';
import { createHolochainSchema } from '@valueflows/vf-graphql-holochain';
import { setClient } from 'svelte-apollo';
import { AgentSchema } from '$lib/schemas/hrea.schemas';
import type { Agent } from '$lib/types/hrea';
import { CREATE_PERSON_MUTATION } from '$lib/graphql/mutations/agent.mutations';
import { GET_AGENT_QUERY, GET_AGENTS_QUERY } from '$lib/graphql/queries/agent.queries';

// --- Service Interface ---

export interface HreaService {
  readonly initialize: () => E.Effect<ApolloClient<any>, HreaError>;
  readonly createPerson: (params: { name: string; note?: string }) => E.Effect<Agent, HreaError>;
  readonly getAgent: (params: { id: string }) => E.Effect<Agent, HreaError>;
  readonly getAgents: () => E.Effect<ReadonlyArray<Agent>, HreaError>;
}

export class HreaServiceTag extends Context.Tag('HreaService')<HreaServiceTag, HreaService>() {}

export const HreaServiceLive: Layer.Layer<HreaServiceTag, never, HolochainClientServiceTag> =
  Layer.effect(
    HreaServiceTag,
    E.gen(function* ($) {
      const holochainClient = yield* $(HolochainClientServiceTag);
      let apolloClient: ApolloClient<any>;

      const initialize = (): E.Effect<ApolloClient<any>, HreaError> =>
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
            return apolloClient;
          }),
          E.mapError((error) => HreaError.fromError(error, 'Failed to initialize Apollo Client'))
        );

      const createPerson = (params: { name: string; note?: string }) =>
        pipe(
          E.tryPromise({
            try: () =>
              apolloClient.mutate({
                mutation: CREATE_PERSON_MUTATION,
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

      const getAgent = (params: { id: string }) =>
        pipe(
          E.tryPromise({
            try: () => apolloClient.query({ query: GET_AGENT_QUERY, variables: { id: params.id } }),
            catch: (error) => HreaError.fromError(error, 'Failed to fetch agent')
          }),
          E.flatMap((result) => Schema.decodeUnknown(AgentSchema)(result.data.agent)),
          E.mapError((error) => HreaError.fromError(error, 'Failed to parse agent data'))
        );

      const getAgents = () =>
        pipe(
          E.tryPromise({
            try: () => apolloClient.query({ query: GET_AGENTS_QUERY }),
            catch: (error) => HreaError.fromError(error, 'Failed to fetch agents')
          }),
          E.flatMap((result) =>
            Schema.decodeUnknown(Schema.Array(AgentSchema))(result.data.agents)
          ),
          E.mapError((error) => HreaError.fromError(error, 'Failed to parse agents data'))
        );

      return HreaServiceTag.of({
        initialize,
        createPerson,
        getAgent,
        getAgents
      });
    })
  );
