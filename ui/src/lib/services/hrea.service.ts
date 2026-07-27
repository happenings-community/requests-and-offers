import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { Effect as E, Layer, Context, pipe, Schema as S } from 'effect';
import { GraphQLSchema } from 'graphql';
import { HreaError } from '$lib/errors';
import { HREA_CONTEXTS } from '$lib/errors/error-contexts';
import { ApolloClient, InMemoryCache } from '@apollo/client/core';
import { SchemaLink } from '@apollo/client/link/schema';
import { createHolochainSchema } from '@valueflows/vf-graphql-holochain';
import type {
  Agent,
  ResourceSpecification,
  Proposal,
  Intent,
  GraphQLIntentResponse,
  GraphQLProposalResponse
} from '$lib/types/hrea';

/**
 * GraphQL response types for proper typing
 */
interface GraphQLEdge<T> {
  node: T;
}

/**
 * Predicate identifying the known Holochain error signature raised when a zome
 * function does not exist in the installed DNA. Used to distinguish a genuine
 * missing-zome-fn (returns empty array) from any other failure (must propagate).
 */
export function isMissingZomeFunctionError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error ?? '');
  return (
    message.includes("doesn't exist") ||
    message.includes('does not exist') ||
    message.includes('no function with name')
  );
}

/**
 * Normalizes a GraphQL intent response (with nested objects) into a flat Intent
 * that matches the domain model used throughout the codebase.
 */
export function normalizeIntentResponse(raw: GraphQLIntentResponse): Intent {
  const action = typeof raw.action === 'object' && raw.action !== null ? raw.action.id : raw.action;
  const provider =
    typeof raw.provider === 'object' && raw.provider !== null ? raw.provider.id : raw.provider;
  const receiver =
    typeof raw.receiver === 'object' && raw.receiver !== null ? raw.receiver.id : raw.receiver;
  const resourceSpecifiedBy = raw.resourceConformsTo?.id || raw.resourceSpecifiedBy || undefined;

  let resourceQuantity: Intent['resourceQuantity'] = undefined;
  if (raw.resourceQuantity) {
    const hasUnit =
      typeof raw.resourceQuantity.hasUnit === 'object' && raw.resourceQuantity.hasUnit !== null
        ? raw.resourceQuantity.hasUnit.id
        : raw.resourceQuantity.hasUnit;
    resourceQuantity = {
      hasNumericalValue: raw.resourceQuantity.hasNumericalValue,
      hasUnit
    };
  }

  return {
    id: raw.id,
    action,
    revisionId: raw.revisionId,
    provider: provider || undefined,
    receiver: receiver || undefined,
    resourceSpecifiedBy,
    resourceQuantity,
    note: raw.note
  };
}

/**
 * Normalizes a GraphQL proposal response into a flat Proposal
 * that matches the domain model used throughout the codebase.
 */
export function normalizeProposalResponse(raw: GraphQLProposalResponse): Proposal {
  return {
    id: raw.id,
    name: raw.name,
    note: raw.note,
    created: raw.created,
    revisionId: raw.revisionId,
    hasBeginning: raw.hasBeginning,
    hasEnd: raw.hasEnd,
    unitBased: raw.unitBased
  };
}

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
  readonly initialize: () => E.Effect<ApolloClient<unknown>, HreaError>;
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
    hasBeginning?: string;
    hasEnd?: string;
    unitBased?: boolean;
  }) => E.Effect<Proposal, HreaError>;
  readonly updateProposal: (params: {
    id: string;
    name: string;
    note?: string;
    hasBeginning?: string;
    hasEnd?: string;
    unitBased?: boolean;
  }) => E.Effect<Proposal, HreaError>;
  readonly deleteProposal: (params: { revisionId: string }) => E.Effect<boolean, HreaError>;
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
    reciprocal?: boolean;
  }) => E.Effect<boolean, HreaError>;
  readonly updateIntent: (params: {
    id: string;
    action: string;
    provider?: string;
    receiver?: string;
    resourceSpecifiedBy?: string;
  }) => E.Effect<Intent, HreaError>;
  readonly deleteIntent: (params: { revisionId: string }) => E.Effect<boolean, HreaError>;
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
      const holochainClient = yield* HolochainClientServiceTag;

      // ── Memoized Apollo client ──────────────────────────────────────────────
      // The Apollo client (and the underlying hREA GraphQL schema) is constructed
      // exactly once per service lifetime. The in-flight Promise is cached so that
      // concurrent first-calls and all subsequent calls share a single client.
      // Previous implementation re-ran the full constructor chain on every method.
      let clientPromise: Promise<ApolloClient<unknown>> | null = null;

      const buildClient = async (): Promise<ApolloClient<unknown>> => {
        await holochainClient.waitForConnection();
        const hcClient = holochainClient.client;
        if (!hcClient) {
          throw new Error('Holochain client is not available after connection');
        }
        const schema = createHolochainSchema({
          appWebSocket: hcClient,
          roleName: 'hrea' // must match the role name in happ.yaml
        });
        return new ApolloClient({
          link: new SchemaLink({ schema: schema as unknown as GraphQLSchema }),
          cache: new InMemoryCache(),
          defaultOptions: {
            query: { fetchPolicy: 'cache-first' },
            mutate: { fetchPolicy: 'no-cache' }
          }
        });
      };

      const getClient = (): E.Effect<ApolloClient<unknown>, HreaError> => {
        if (!clientPromise) {
          clientPromise = buildClient();
        }
        return E.tryPromise({
          try: () => clientPromise as Promise<ApolloClient<unknown>>,
          catch: (error) => HreaError.fromError(error, HREA_CONTEXTS.INITIALIZE)
        });
      };

      const initialize = getClient;

      const createPerson = (params: { name: string; note?: string }): E.Effect<Agent, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {

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

                const result = await client.query({
                  query: GET_AGENT_QUERY,
                  variables: { id },
                  fetchPolicy: 'network-only'
                });

                const agent = result.data?.agent || null;
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

                const result = await client.query({
                  query: GET_AGENTS_QUERY,
                  fetchPolicy: 'network-only'
                });

                const agents =
                  result.data?.agents?.edges?.map((edge: GraphQLEdge<Agent>) => edge.node) || [];
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

                const result = await client.mutate({
                  mutation: DELETE_RESOURCE_SPECIFICATION_MUTATION,
                  variables: {
                    id: params.id
                  }
                });

                const success = result.data?.deleteResourceSpecification || false;
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

                const result = await client.query({
                  query: GET_RESOURCE_SPECIFICATION_QUERY,
                  variables: { id },
                  fetchPolicy: 'network-only'
                });

                const resourceSpec = result.data?.resourceSpecification || null;
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

                const result = await client.query({
                  query: GET_RESOURCE_SPECIFICATIONS_QUERY,
                  fetchPolicy: 'network-only'
                });

                const resourceSpecs =
                  result.data?.resourceSpecifications?.edges?.map(
                    (edge: GraphQLEdge<ResourceSpecification>) => edge.node
                  ) || [];
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

                const result = await client.query({
                  query: GET_RESOURCE_SPECIFICATIONS_BY_CLASS_QUERY,
                  variables: { classifiedAs },
                  fetchPolicy: 'network-only'
                });

                const resourceSpecs =
                  result.data?.resourceSpecifications?.edges?.map(
                    (edge: GraphQLEdge<ResourceSpecification>) => edge.node
                  ) || [];
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
        hasBeginning?: string;
        hasEnd?: string;
        unitBased?: boolean;
      }): E.Effect<Proposal, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {

                const result = await client.mutate({
                  mutation: CREATE_PROPOSAL_MUTATION,
                  variables: {
                    proposal: {
                      name: params.name,
                      note: params.note,
                      hasBeginning: params.hasBeginning,
                      hasEnd: params.hasEnd,
                      unitBased: params.unitBased
                    }
                  }
                });

                const proposal = result.data?.createProposal?.proposal;
                if (!proposal) {
                  throw new Error(`${HREA_CONTEXTS.CREATE_PROPOSAL}: No proposal returned`);
                }

                return normalizeProposalResponse(proposal);
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
        hasBeginning?: string;
        hasEnd?: string;
        unitBased?: boolean;
      }): E.Effect<Proposal, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {

                const result = await client.mutate({
                  mutation: UPDATE_PROPOSAL_MUTATION,
                  variables: {
                    proposal: {
                      revisionId: params.id,
                      name: params.name,
                      note: params.note,
                      hasBeginning: params.hasBeginning,
                      hasEnd: params.hasEnd,
                      unitBased: params.unitBased
                    }
                  }
                });

                const proposal = result.data?.updateProposal?.proposal;
                if (!proposal) {
                  throw new Error(`${HREA_CONTEXTS.UPDATE_PROPOSAL}: No proposal returned`);
                }

                return normalizeProposalResponse(proposal);
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.UPDATE_PROPOSAL))
        );

      const deleteProposal = (params: { revisionId: string }): E.Effect<boolean, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {

                const result = await client.mutate({
                  mutation: DELETE_PROPOSAL_MUTATION,
                  variables: {
                    revisionId: params.revisionId
                  }
                });

                const success = result.data?.deleteProposal || false;
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

                const result = await client.query({
                  query: GET_PROPOSAL_QUERY,
                  variables: { id },
                  fetchPolicy: 'network-only'
                });

                const proposal = result.data?.proposal || null;
                return proposal ? normalizeProposalResponse(proposal) : null;
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

                const result = await client.query({
                  query: GET_PROPOSALS_QUERY,
                  fetchPolicy: 'network-only'
                });

                const proposals =
                  result.data?.proposals?.edges?.map((edge: GraphQLEdge<GraphQLProposalResponse>) =>
                    normalizeProposalResponse(edge.node)
                  ) || [];
                return proposals;
              },
              catch: (error) => error
            })
          ),
          E.catchAll((error) => {
            if (isMissingZomeFunctionError(error)) {
              return E.succeed([] as Proposal[]);
            }
            return E.fail(HreaError.fromError(error, HREA_CONTEXTS.GET_PROPOSALS));
          })
        );

      const getProposalsByAgent = (agentId: string): E.Effect<Proposal[], HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {

                const result = await client.query({
                  query: GET_PROPOSALS_BY_AGENT_QUERY,
                  variables: { agentId },
                  fetchPolicy: 'network-only'
                });

                const proposals =
                  result.data?.proposals?.edges?.map((edge: GraphQLEdge<GraphQLProposalResponse>) =>
                    normalizeProposalResponse(edge.node)
                  ) || [];
                return proposals;
              },
              catch: (error) => error
            })
          ),
          E.catchAll((error) => {
            const errorStr = String(error);
            if (errorStr.includes("doesn't exist") || errorStr.includes('does not exist')) {
              return E.succeed([] as Proposal[]);
            }
            return E.fail(HreaError.fromError(error, HREA_CONTEXTS.GET_PROPOSALS_BY_AGENT));
          })
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

                const result = await client.mutate({
                  mutation: CREATE_INTENT_MUTATION,
                  variables: {
                    intent: {
                      action: params.action,
                      provider: params.provider,
                      receiver: params.receiver,
                      resourceConformsTo: params.resourceSpecifiedBy,
                      resourceQuantity: params.resourceQuantity
                    }
                  }
                });

                const intent = result.data?.createIntent?.intent;
                if (!intent) {
                  throw new Error(`${HREA_CONTEXTS.CREATE_INTENT}: No intent returned`);
                }

                return normalizeIntentResponse(intent);
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.CREATE_INTENT))
        );

      const proposeIntent = (params: {
        intentId: string;
        proposalId: string;
        reciprocal?: boolean;
      }): E.Effect<boolean, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {

                const result = await client.mutate({
                  mutation: PROPOSE_INTENT_MUTATION,
                  variables: {
                    publishedIn: params.proposalId,
                    publishes: params.intentId,
                    reciprocal: params.reciprocal ?? false
                  }
                });

                const success = !!result.data?.proposeIntent?.proposedIntent;
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

                const result = await client.mutate({
                  mutation: UPDATE_INTENT_MUTATION,
                  variables: {
                    intent: {
                      revisionId: params.id,
                      action: params.action,
                      provider: params.provider,
                      receiver: params.receiver,
                      resourceConformsTo: params.resourceSpecifiedBy
                    }
                  }
                });

                const intent = result.data?.updateIntent?.intent;
                if (!intent) {
                  throw new Error(`${HREA_CONTEXTS.UPDATE_INTENT}: No intent returned`);
                }

                return normalizeIntentResponse(intent);
              },
              catch: (error) => error
            })
          ),
          E.mapError((error) => HreaError.fromError(error, HREA_CONTEXTS.UPDATE_INTENT))
        );

      const deleteIntent = (params: { revisionId: string }): E.Effect<boolean, HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {

                const result = await client.mutate({
                  mutation: DELETE_INTENT_MUTATION,
                  variables: {
                    revisionId: params.revisionId
                  }
                });

                const success = result.data?.deleteIntent || false;
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

                const result = await client.query({
                  query: GET_INTENT_QUERY,
                  variables: { id },
                  fetchPolicy: 'network-only'
                });

                const intent = result.data?.intent || null;
                return intent ? normalizeIntentResponse(intent) : null;
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

                const result = await client.query({
                  query: GET_INTENTS_QUERY,
                  fetchPolicy: 'network-only'
                });

                const intents =
                  result.data?.intents?.edges?.map((edge: GraphQLEdge<GraphQLIntentResponse>) =>
                    normalizeIntentResponse(edge.node)
                  ) || [];
                return intents;
              },
              catch: (error) => error
            })
          ),
          E.catchAll((error) => {
            const errorStr = String(error);
            if (errorStr.includes("doesn't exist") || errorStr.includes('does not exist')) {
              return E.succeed([] as Intent[]);
            }
            return E.fail(HreaError.fromError(error, HREA_CONTEXTS.GET_INTENTS));
          })
        );

      const getIntentsByProposal = (proposalId: string): E.Effect<Intent[], HreaError> =>
        pipe(
          initialize(),
          E.flatMap((client) =>
            E.tryPromise({
              try: async () => {

                const result = await client.query({
                  query: GET_INTENTS_BY_PROPOSAL_QUERY,
                  variables: { proposalId },
                  fetchPolicy: 'network-only'
                });

                const intents =
                  result.data?.intents?.edges?.map((edge: GraphQLEdge<GraphQLIntentResponse>) =>
                    normalizeIntentResponse(edge.node)
                  ) || [];
                return intents;
              },
              catch: (error) => error
            })
          ),
          E.catchAll((error) => {
            const errorStr = String(error);
            if (errorStr.includes("doesn't exist") || errorStr.includes('does not exist')) {
              return E.succeed([] as Intent[]);
            }
            return E.fail(HreaError.fromError(error, HREA_CONTEXTS.GET_INTENTS_BY_PROPOSAL));
          })
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
