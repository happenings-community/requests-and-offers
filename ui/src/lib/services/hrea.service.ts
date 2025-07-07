import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { Effect as E, Layer, Context, pipe } from 'effect';
import { HreaError } from '$lib/errors';
import { ApolloClient, InMemoryCache } from '@apollo/client/core';
import { SchemaLink } from '@apollo/client/link/schema';
import { createHolochainSchema } from '@valueflows/vf-graphql-holochain';
import type { Agent, ResourceSpecification } from '$lib/types/hrea';
import {
  CREATE_PERSON_MUTATION,
  UPDATE_PERSON_MUTATION,
  CREATE_ORGANIZATION_MUTATION,
  UPDATE_ORGANIZATION_MUTATION
} from '$lib/graphql/mutations/agent.mutations';
import { GET_AGENT_QUERY, GET_AGENTS_QUERY } from '$lib/graphql/queries/agent.queries';
import {
  CREATE_RESOURCE_SPECIFICATION_MUTATION,
  UPDATE_RESOURCE_SPECIFICATION_MUTATION,
  DELETE_RESOURCE_SPECIFICATION_MUTATION
} from '$lib/graphql/mutations/resourceSpecification.mutations';
import {
  GET_RESOURCE_SPECIFICATION_QUERY,
  GET_RESOURCE_SPECIFICATIONS_QUERY,
  GET_RESOURCE_SPECIFICATIONS_BY_CLASS_QUERY
} from '$lib/graphql/queries/resourceSpecification.queries';

// Service interface for hREA operations
export interface HreaService {
  readonly initialize: () => E.Effect<ApolloClient<any>, HreaError>;
  readonly createPerson: (params: { name: string; note?: string }) => E.Effect<Agent, HreaError>;
  readonly updatePerson: (params: {
    id: string;
    name: string;
    note?: string;
  }) => E.Effect<Agent, HreaError>;
  readonly createOrganization: (params: {
    name: string;
    note?: string;
  }) => E.Effect<Agent, HreaError>;
  readonly updateOrganization: (params: {
    id: string;
    name: string;
    note?: string;
  }) => E.Effect<Agent, HreaError>;
  readonly getAgent: (id: string) => E.Effect<Agent | null, HreaError>;
  readonly getAgents: () => E.Effect<Agent[], HreaError>;
  readonly createResourceSpecification: (params: {
    name: string;
    note?: string;
  }) => E.Effect<ResourceSpecification, HreaError>;
  readonly updateResourceSpecification: (params: {
    id: string;
    name: string;
    note?: string;
  }) => E.Effect<ResourceSpecification, HreaError>;
  readonly deleteResourceSpecification: (params: { id: string }) => E.Effect<boolean, HreaError>;
  readonly getResourceSpecification: (
    id: string
  ) => E.Effect<ResourceSpecification | null, HreaError>;
  readonly getResourceSpecifications: () => E.Effect<ResourceSpecification[], HreaError>;
  readonly getResourceSpecificationsByClass: (
    classifiedAs: string[]
  ) => E.Effect<ResourceSpecification[], HreaError>;
}

// Context tag for dependency injection
export class HreaServiceTag extends Context.Tag('HreaService')<HreaServiceTag, HreaService>() {}

export const HreaServiceLive: Layer.Layer<HreaServiceTag, never, HolochainClientServiceTag> =
  Layer.effect(
    HreaServiceTag,
    E.gen(function* () {
      console.log('hREA Service: Initializing hREA GraphQL service with Holochain integration...');
      const holochainClient = yield* HolochainClientServiceTag;

      const initialize = (): E.Effect<ApolloClient<any>, HreaError> =>
        pipe(
          E.gen(function* () {
            console.log('hREA Service: Creating Apollo GraphQL client with Holochain schema...');

            // Get the actual Holochain client instance using Effect
            const hcClient = yield* holochainClient.connectClientEffect();

            console.log('hREA Service: Creating hREA GraphQL schema...');
            // Create GraphQL schema using Holochain client and hREA role
            const schema = createHolochainSchema({
              appWebSocket: hcClient,
              roleName: 'hrea' // This must match the role name in happ.yaml
            });

            console.log('hREA Service: Creating Apollo client with schema link...');
            // Create Apollo Client with SchemaLink (no HTTP connection needed)
            const client = new ApolloClient({
              link: new SchemaLink({ schema }),
              cache: new InMemoryCache(),
              defaultOptions: {
                query: {
                  fetchPolicy: 'cache-first'
                },
                mutate: {
                  fetchPolicy: 'no-cache'
                }
              }
            });

            console.log('hREA Service: Apollo GraphQL client created successfully');
            return client;
          }),
          E.mapError((error) =>
            HreaError.fromError(error, 'Failed to initialize hREA GraphQL client')
          )
        );

      const createPerson = (params: { name: string; note?: string }): E.Effect<Agent, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Creating person agent via GraphQL:', params);

                const result = await client.mutate({
                  mutation: CREATE_PERSON_MUTATION,
                  variables: {
                    person: {
                      name: params.name,
                      note: params.note
                    }
                  }
                });

                const agent = result.data?.createPerson?.agent;
                if (!agent) {
                  throw new Error('Failed to create person agent: No agent returned');
                }

                console.log('hREA Service: Person agent created:', agent.id);
                return agent as Agent;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, 'Failed to create person agent'))
        );

      const updatePerson = (params: {
        id: string;
        name: string;
        note?: string;
      }): E.Effect<Agent, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Updating person agent via GraphQL:', params);

                const result = await client.mutate({
                  mutation: UPDATE_PERSON_MUTATION,
                  variables: {
                    id: params.id,
                    person: {
                      name: params.name,
                      note: params.note
                    }
                  }
                });

                const agent = result.data?.updatePerson?.agent;
                if (!agent) {
                  throw new Error('Failed to update person agent: No agent returned');
                }

                console.log('hREA Service: Person agent updated:', agent.id);
                return agent as Agent;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, 'Failed to update person agent'))
        );

      const createOrganization = (params: {
        name: string;
        note?: string;
      }): E.Effect<Agent, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Creating organization agent via GraphQL:', params);

                const result = await client.mutate({
                  mutation: CREATE_ORGANIZATION_MUTATION,
                  variables: {
                    organization: {
                      name: params.name,
                      note: params.note
                    }
                  }
                });

                const agent = result.data?.createOrganization?.agent;
                if (!agent) {
                  throw new Error('Failed to create organization agent: No agent returned');
                }

                console.log('hREA Service: Organization agent created:', agent.id);
                return agent as Agent;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, 'Failed to create organization agent'))
        );

      const updateOrganization = (params: {
        id: string;
        name: string;
        note?: string;
      }): E.Effect<Agent, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Updating organization agent via GraphQL:', params);

                const result = await client.mutate({
                  mutation: UPDATE_ORGANIZATION_MUTATION,
                  variables: {
                    id: params.id,
                    organization: {
                      name: params.name,
                      note: params.note
                    }
                  }
                });

                const agent = result.data?.updateOrganization?.agent;
                if (!agent) {
                  throw new Error('Failed to update organization agent: No agent returned');
                }

                console.log('hREA Service: Organization agent updated:', agent.id);
                return agent as Agent;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, 'Failed to update organization agent'))
        );

      const getAgent = (id: string): E.Effect<Agent | null, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Getting agent via GraphQL:', id);

                const result = await client.query({
                  query: GET_AGENT_QUERY,
                  variables: { id },
                  fetchPolicy: 'network-only'
                });

                const agent = result.data?.agent || null;
                console.log('hREA Service: Agent found:', !!agent);
                return agent as Agent | null;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, 'Failed to get agent'))
        );

      const getAgents = (): E.Effect<Agent[], HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Getting all agents via GraphQL...');

                const result = await client.query({
                  query: GET_AGENTS_QUERY,
                  fetchPolicy: 'network-only'
                });

                const agents = result.data?.agents?.edges?.map((edge: any) => edge.node) || [];
                console.log('hREA Service: Agents found, count:', agents.length);
                return agents as Agent[];
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, 'Failed to get agents'))
        );

      const createResourceSpecification = (params: {
        name: string;
        note?: string;
      }): E.Effect<ResourceSpecification, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Creating resource specification via GraphQL:', params);

                const result = await client.mutate({
                  mutation: CREATE_RESOURCE_SPECIFICATION_MUTATION,
                  variables: {
                    resourceSpecification: {
                      name: params.name,
                      note: params.note
                    }
                  }
                });

                const resourceSpec =
                  result.data?.createResourceSpecification?.resourceSpecification;
                if (!resourceSpec) {
                  throw new Error(
                    'Failed to create resource specification: No resource specification returned'
                  );
                }

                console.log('hREA Service: Resource specification created:', resourceSpec.id);
                return resourceSpec as ResourceSpecification;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) =>
            HreaError.fromError(error, 'Failed to create resource specification')
          )
        );

      const updateResourceSpecification = (params: {
        id: string;
        name: string;
        note?: string;
      }): E.Effect<ResourceSpecification, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Updating resource specification via GraphQL:', params);

                const result = await client.mutate({
                  mutation: UPDATE_RESOURCE_SPECIFICATION_MUTATION,
                  variables: {
                    id: params.id,
                    resourceSpecification: {
                      name: params.name,
                      note: params.note
                    }
                  }
                });

                const resourceSpec =
                  result.data?.updateResourceSpecification?.resourceSpecification;
                if (!resourceSpec) {
                  throw new Error(
                    'Failed to update resource specification: No resource specification returned'
                  );
                }

                console.log('hREA Service: Resource specification updated:', resourceSpec.id);
                return resourceSpec as ResourceSpecification;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) =>
            HreaError.fromError(error, 'Failed to update resource specification')
          )
        );

      const deleteResourceSpecification = (params: { id: string }): E.Effect<boolean, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log(
                  'hREA Service: Deleting resource specification via GraphQL:',
                  params.id
                );

                const result = await client.mutate({
                  mutation: DELETE_RESOURCE_SPECIFICATION_MUTATION,
                  variables: {
                    id: params.id
                  }
                });

                const success = result.data?.deleteResourceSpecification || false;
                console.log('hREA Service: Resource specification deleted successfully:', success);
                return success;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) =>
            HreaError.fromError(error, 'Failed to delete resource specification')
          )
        );

      const getResourceSpecification = (
        id: string
      ): E.Effect<ResourceSpecification | null, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Getting resource specification via GraphQL:', id);

                const result = await client.query({
                  query: GET_RESOURCE_SPECIFICATION_QUERY,
                  variables: { id },
                  fetchPolicy: 'network-only'
                });

                const resourceSpec = result.data?.resourceSpecification || null;
                console.log('hREA Service: Resource specification found:', !!resourceSpec);
                return resourceSpec as ResourceSpecification | null;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, 'Failed to get resource specification'))
        );

      const getResourceSpecifications = (): E.Effect<ResourceSpecification[], HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Getting all resource specifications via GraphQL...');

                const result = await client.query({
                  query: GET_RESOURCE_SPECIFICATIONS_QUERY,
                  fetchPolicy: 'network-only'
                });

                const resourceSpecs =
                  result.data?.resourceSpecifications?.edges?.map((edge: any) => edge.node) || [];
                console.log(
                  'hREA Service: Resource specifications found, count:',
                  resourceSpecs.length
                );
                return resourceSpecs as ResourceSpecification[];
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, 'Failed to get resource specifications'))
        );

      const getResourceSpecificationsByClass = (
        classifiedAs: string[]
      ): E.Effect<ResourceSpecification[], HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log(
                  'hREA Service: Getting resource specifications by classification via GraphQL:',
                  classifiedAs
                );

                const result = await client.query({
                  query: GET_RESOURCE_SPECIFICATIONS_BY_CLASS_QUERY,
                  variables: { classifiedAs },
                  fetchPolicy: 'network-only'
                });

                const resourceSpecs =
                  result.data?.resourceSpecifications?.edges?.map((edge: any) => edge.node) || [];
                console.log(
                  'hREA Service: Filtered resource specifications found, count:',
                  resourceSpecs.length
                );
                return resourceSpecs as ResourceSpecification[];
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) =>
            HreaError.fromError(error, 'Failed to get resource specifications by classification')
          )
        );

      return HreaServiceTag.of({
        initialize,
        createPerson,
        updatePerson,
        createOrganization,
        updateOrganization,
        getAgent,
        getAgents,
        createResourceSpecification,
        updateResourceSpecification,
        deleteResourceSpecification,
        getResourceSpecification,
        getResourceSpecifications,
        getResourceSpecificationsByClass
      });
    })
  );
