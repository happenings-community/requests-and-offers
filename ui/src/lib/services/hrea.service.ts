import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { Effect as E, Layer, Context, pipe, Schema as S } from 'effect';
import { HreaError } from '$lib/errors';
import { HREA_CONTEXTS } from '$lib/errors/error-contexts';
import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';
import { SchemaLink } from '@apollo/client/link/schema';
import { createHolochainSchema } from '@valueflows/vf-graphql-holochain';
import type { Agent, ResourceSpecification, Proposal, Intent } from '$lib/types/hrea';
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
import {
  CREATE_PROPOSAL_MUTATION,
  UPDATE_PROPOSAL_MUTATION,
  DELETE_PROPOSAL_MUTATION
} from '$lib/graphql/mutations/proposal.mutations';
import {
  GET_PROPOSAL_QUERY,
  GET_PROPOSALS_QUERY,
  GET_PROPOSALS_BY_AGENT_QUERY
} from '$lib/graphql/queries/proposal.queries';
import {
  CREATE_INTENT_MUTATION,
  PROPOSE_INTENT_MUTATION,
  UPDATE_INTENT_MUTATION,
  DELETE_INTENT_MUTATION
} from '$lib/graphql/mutations/intent.mutations';
import {
  GET_INTENT_QUERY,
  GET_INTENTS_QUERY,
  GET_INTENTS_BY_PROPOSAL_QUERY
} from '$lib/graphql/queries/intent.queries';

const AgentSchema = S.Struct({
  id: S.String,
  name: S.String,
  note: S.optional(S.String)
});

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
  // Proposal operations
  readonly createProposal: (params: {
    name: string;
    note?: string;
    publishes: string[]; // Required: array of intent IDs
  }) => E.Effect<Proposal, HreaError>;
  readonly updateProposal: (params: {
    id: string;
    name: string;
    note?: string;
  }) => E.Effect<Proposal, HreaError>;
  readonly deleteProposal: (params: { id: string }) => E.Effect<boolean, HreaError>;
  readonly getProposal: (id: string) => E.Effect<Proposal | null, HreaError>;
  readonly getProposals: () => E.Effect<Proposal[], HreaError>;
  readonly getProposalsByAgent: (agentId: string) => E.Effect<Proposal[], HreaError>;
  // Intent operations
  readonly createIntent: (params: {
    action: string;
    provider?: string;
    receiver?: string;
    resourceSpecifiedBy?: string;
    resourceQuantity?: { hasNumericalValue: number; hasUnit: string };
  }) => E.Effect<Intent, HreaError>;
  readonly proposeIntent: (params: {
    intentId: string;
    proposalId: string;
  }) => E.Effect<boolean, HreaError>;
  readonly updateIntent: (params: {
    id: string;
    action: string;
    provider?: string;
    receiver?: string;
    resourceSpecifiedBy?: string;
  }) => E.Effect<Intent, HreaError>;
  readonly deleteIntent: (params: { id: string }) => E.Effect<boolean, HreaError>;
  readonly getIntent: (id: string) => E.Effect<Intent | null, HreaError>;
  readonly getIntents: () => E.Effect<Intent[], HreaError>;
  readonly getIntentsByProposal: (proposalId: string) => E.Effect<Intent[], HreaError>;
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
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.INITIALIZE))
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
                  throw new Error(`${HREA_CONTEXTS.CREATE_PERSON}: No agent returned`);
                }

                // Validate the agent against the schema
                const decodedAgent = S.decodeUnknownSync(AgentSchema)(agent) as Agent;

                console.log('hREA Service: Person agent created:', decodedAgent.id);
                return decodedAgent;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.CREATE_PERSON))
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
                  throw new Error(`${HREA_CONTEXTS.UPDATE_PERSON}: No agent returned`);
                }

                console.log('hREA Service: Person agent updated:', agent.id);
                return agent as Agent;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.UPDATE_PERSON))
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
                  throw new Error(`${HREA_CONTEXTS.CREATE_ORGANIZATION}: No agent returned`);
                }

                console.log('hREA Service: Organization agent created:', agent.id);
                return agent as Agent;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.CREATE_ORGANIZATION))
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
                  throw new Error(`${HREA_CONTEXTS.UPDATE_ORGANIZATION}: No agent returned`);
                }

                console.log('hREA Service: Organization agent updated:', agent.id);
                return agent as Agent;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.UPDATE_ORGANIZATION))
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
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.GET_AGENT))
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
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.GET_AGENTS))
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
                    `${HREA_CONTEXTS.CREATE_RESOURCE_SPEC}: No resource specification returned`
                  );
                }

                console.log('hREA Service: Resource specification created:', resourceSpec.id);
                return resourceSpec as ResourceSpecification;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.CREATE_RESOURCE_SPEC))
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
                    `${HREA_CONTEXTS.UPDATE_RESOURCE_SPEC}: No resource specification returned`
                  );
                }

                console.log('hREA Service: Resource specification updated:', resourceSpec.id);
                return resourceSpec as ResourceSpecification;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.UPDATE_RESOURCE_SPEC))
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
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.DELETE_RESOURCE_SPEC))
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
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.GET_RESOURCE_SPEC))
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
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.GET_RESOURCE_SPECS))
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
            HreaError.fromError(error, HREA_CONTEXTS.GET_RESOURCE_SPECS_BY_CLASS)
          )
        );

      // Proposal operations
      const createProposal = (params: {
        name: string;
        note?: string;
        publishes: string[]; // Required: array of intent IDs
      }): E.Effect<Proposal, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Creating proposal via GraphQL:', params);

                const result = await client.mutate({
                  mutation: CREATE_PROPOSAL_MUTATION,
                  variables: {
                    proposal: {
                      name: params.name,
                      note: params.note,
                      publishes: params.publishes
                    }
                  }
                });

                const proposal = result.data?.createProposal?.proposal;
                if (!proposal) {
                  throw new Error(`${HREA_CONTEXTS.CREATE_PROPOSAL}: No proposal returned`);
                }

                console.log('hREA Service: Proposal created:', proposal.id);
                return proposal as Proposal;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.CREATE_PROPOSAL))
        );

      const updateProposal = (params: {
        id: string;
        name: string;
        note?: string;
      }): E.Effect<Proposal, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Updating proposal via GraphQL:', params);

                const result = await client.mutate({
                  mutation: UPDATE_PROPOSAL_MUTATION,
                  variables: {
                    id: params.id,
                    proposal: {
                      name: params.name,
                      note: params.note
                    }
                  }
                });

                const proposal = result.data?.updateProposal?.proposal;
                if (!proposal) {
                  throw new Error(`${HREA_CONTEXTS.UPDATE_PROPOSAL}: No proposal returned`);
                }

                console.log('hREA Service: Proposal updated:', proposal.id);
                return proposal as Proposal;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.UPDATE_PROPOSAL))
        );

      const deleteProposal = (params: { id: string }): E.Effect<boolean, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Deleting proposal via GraphQL:', params.id);

                const result = await client.mutate({
                  mutation: DELETE_PROPOSAL_MUTATION,
                  variables: {
                    id: params.id
                  }
                });

                const success = result.data?.deleteProposal || false;
                console.log('hREA Service: Proposal deleted successfully:', success);
                return success;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.DELETE_PROPOSAL))
        );

      const getProposal = (id: string): E.Effect<Proposal | null, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Getting proposal via GraphQL:', id);

                const result = await client.query({
                  query: GET_PROPOSAL_QUERY,
                  variables: { id },
                  fetchPolicy: 'network-only'
                });

                const proposal = result.data?.proposal || null;
                console.log('hREA Service: Proposal found:', !!proposal);
                return proposal as Proposal | null;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.GET_PROPOSAL))
        );

      const getProposals = (): E.Effect<Proposal[], HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Getting all proposals via GraphQL...');

                const result = await client.query({
                  query: GET_PROPOSALS_QUERY,
                  fetchPolicy: 'network-only'
                });

                const proposals =
                  result.data?.proposals?.edges?.map((edge: any) => edge.node) || [];
                console.log('hREA Service: Proposals found, count:', proposals.length);
                return proposals as Proposal[];
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.GET_PROPOSALS))
        );

      const getProposalsByAgent = (agentId: string): E.Effect<Proposal[], HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Getting proposals by agent via GraphQL:', agentId);

                const result = await client.query({
                  query: GET_PROPOSALS_BY_AGENT_QUERY,
                  variables: { agentId },
                  fetchPolicy: 'network-only'
                });

                const proposals =
                  result.data?.proposals?.edges?.map((edge: any) => edge.node) || [];
                console.log('hREA Service: Agent proposals found, count:', proposals.length);
                return proposals as Proposal[];
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.GET_PROPOSALS_BY_AGENT))
        );

      // Intent operations
      const createIntent = (params: {
        action: string;
        provider?: string;
        receiver?: string;
        resourceSpecifiedBy?: string;
        resourceQuantity?: { hasNumericalValue: number; hasUnit: string };
      }): E.Effect<Intent, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Creating intent via GraphQL:', params);

                const result = await client.mutate({
                  mutation: CREATE_INTENT_MUTATION,
                  variables: {
                    intent: {
                      action: params.action,
                      provider: params.provider,
                      receiver: params.receiver,
                      resourceSpecifiedBy: params.resourceSpecifiedBy,
                      resourceQuantity: params.resourceQuantity
                    }
                  }
                });

                const intent = result.data?.createIntent?.intent;
                if (!intent) {
                  throw new Error(`${HREA_CONTEXTS.CREATE_INTENT}: No intent returned`);
                }

                console.log('hREA Service: Intent created:', intent.id);
                return intent as Intent;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.CREATE_INTENT))
        );

      const proposeIntent = (params: {
        intentId: string;
        proposalId: string;
      }): E.Effect<boolean, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Linking intent to proposal via GraphQL:', params);

                const result = await client.mutate({
                  mutation: PROPOSE_INTENT_MUTATION,
                  variables: {
                    publishedIn: params.proposalId,
                    publishes: params.intentId
                  }
                });

                const success = !!result.data?.proposeIntent?.proposedIntent;
                console.log('hREA Service: Intent linked to proposal successfully:', success);
                return success;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.PROPOSE_INTENT))
        );

      const updateIntent = (params: {
        id: string;
        action: string;
        provider?: string;
        receiver?: string;
        resourceSpecifiedBy?: string;
      }): E.Effect<Intent, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Updating intent via GraphQL:', params);

                const result = await client.mutate({
                  mutation: UPDATE_INTENT_MUTATION,
                  variables: {
                    id: params.id,
                    intent: {
                      action: params.action,
                      provider: params.provider,
                      receiver: params.receiver,
                      resourceSpecifiedBy: params.resourceSpecifiedBy
                    }
                  }
                });

                const intent = result.data?.updateIntent?.intent;
                if (!intent) {
                  throw new Error(`${HREA_CONTEXTS.UPDATE_INTENT}: No intent returned`);
                }

                console.log('hREA Service: Intent updated:', intent.id);
                return intent as Intent;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.UPDATE_INTENT))
        );

      const deleteIntent = (params: { id: string }): E.Effect<boolean, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Deleting intent via GraphQL:', params.id);

                const result = await client.mutate({
                  mutation: DELETE_INTENT_MUTATION,
                  variables: {
                    id: params.id
                  }
                });

                const success = result.data?.deleteIntent || false;
                console.log('hREA Service: Intent deleted successfully:', success);
                return success;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.DELETE_INTENT))
        );

      const getIntent = (id: string): E.Effect<Intent | null, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Getting intent via GraphQL:', id);

                const result = await client.query({
                  query: GET_INTENT_QUERY,
                  variables: { id },
                  fetchPolicy: 'network-only'
                });

                const intent = result.data?.intent || null;
                console.log('hREA Service: Intent found:', !!intent);
                return intent as Intent | null;
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.GET_INTENT))
        );

      const getIntents = (): E.Effect<Intent[], HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Getting all intents via GraphQL...');

                // Try GraphQL introspection first to see what's available
                const introspectionResult = await client.query({
                  query: gql`
                    query IntrospectionQuery {
                      __schema {
                        queryType {
                          fields {
                            name
                            type {
                              name
                            }
                          }
                        }
                      }
                    }
                  `,
                  fetchPolicy: 'network-only'
                });

                const availableQueries =
                  introspectionResult.data?.__schema?.queryType?.fields || [];
                console.log(
                  'hREA Service: Available GraphQL queries:',
                  availableQueries.map((f: any) => f.name)
                );

                // Check if intents query exists
                const hasIntentsQuery = availableQueries.some(
                  (field: any) => field.name === 'intents'
                );
                console.log('hREA Service: Has intents query:', hasIntentsQuery);

                if (!hasIntentsQuery) {
                  console.log('hREA Service: intents query not available, returning empty array');
                  return [] as Intent[];
                }

                const result = await client.query({
                  query: GET_INTENTS_QUERY,
                  fetchPolicy: 'network-only'
                });

                const intents = result.data?.intents?.edges?.map((edge: any) => edge.node) || [];
                console.log('hREA Service: Intents found, count:', intents.length);
                return intents as Intent[];
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.GET_INTENTS))
        );

      const getIntentsByProposal = (proposalId: string): E.Effect<Intent[], HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {
                console.log('hREA Service: Getting intents by proposal via GraphQL:', proposalId);

                const result = await client.query({
                  query: GET_INTENTS_BY_PROPOSAL_QUERY,
                  variables: { proposalId },
                  fetchPolicy: 'network-only'
                });

                const intents = result.data?.intents?.edges?.map((edge: any) => edge.node) || [];
                console.log('hREA Service: Proposal intents found, count:', intents.length);
                return intents as Intent[];
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.GET_INTENTS_BY_PROPOSAL))
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
        getResourceSpecificationsByClass,
        createProposal,
        updateProposal,
        deleteProposal,
        getProposal,
        getProposals,
        getProposalsByAgent,
        createIntent,
        proposeIntent,
        updateIntent,
        deleteIntent,
        getIntent,
        getIntents,
        getIntentsByProposal
      });
    })
  );
