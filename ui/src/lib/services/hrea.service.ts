import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { Effect as E, Layer, Context, pipe } from 'effect';
import { HreaError } from '$lib/errors';
import { ApolloClient, InMemoryCache } from '@apollo/client/core';
import { SchemaLink } from '@apollo/client/link/schema';
import { AgentSchema, ResourceSpecificationSchema } from '$lib/schemas/hrea.schemas';
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
    classifiedAs?: string[];
  }) => E.Effect<ResourceSpecification, HreaError>;
  readonly updateResourceSpecification: (params: {
    id: string;
    name: string;
    note?: string;
    classifiedAs?: string[];
  }) => E.Effect<ResourceSpecification, HreaError>;
  readonly deleteResourceSpecification: (params: { id: string }) => E.Effect<boolean, HreaError>;
  readonly getResourceSpecification: (
    id: string
  ) => E.Effect<ResourceSpecification | null, HreaError>;
  readonly getResourceSpecifications: () => E.Effect<ResourceSpecification[], HreaError>;
  readonly getResourceSpecificationsByClassification: (
    classifiedAs: string[]
  ) => E.Effect<ResourceSpecification[], HreaError>;
}

// Context tag for dependency injection
export class HreaServiceTag extends Context.Tag('HreaService')<HreaServiceTag, HreaService>() {}

// Helper function to generate unique IDs
const generateId = (): string => {
  return `hrea_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// In-memory storage for demonstration (in a real implementation, this would be persisted)
let mockAgents: Agent[] = [];
let mockResourceSpecifications: ResourceSpecification[] = [];

export const HreaServiceLive: Layer.Layer<HreaServiceTag, never, HolochainClientServiceTag> =
  Layer.effect(
    HreaServiceTag,
    E.gen(function* () {
      console.log('hREA Service: Initializing demonstration service...');

      const initialize = (): E.Effect<ApolloClient<any>, HreaError> =>
        pipe(
          E.sync(() => {
            console.log('hREA Service: Creating demonstration Apollo client...');
            // Create a minimal Apollo client for demonstration
            // In a real implementation, this would connect to an actual hREA GraphQL endpoint
            const client = new ApolloClient({
              cache: new InMemoryCache(),
              link: new SchemaLink({
                schema: null as any // Demonstration only
              })
            });
            console.log('hREA Service: Demonstration Apollo client created');
            return client;
          }),
          E.mapError((error) => HreaError.fromError(error, 'Failed to initialize hREA service'))
        );

      const createPerson = (params: { name: string; note?: string }): E.Effect<Agent, HreaError> =>
        pipe(
          E.sync(() => {
            console.log('hREA Service: Creating person agent:', params);
            const agent: Agent = {
              id: generateId(),
              name: params.name,
              ...(params.note && { note: params.note }),
              revisionId: generateId()
            };
            mockAgents.push(agent);
            console.log('hREA Service: Person agent created:', agent.id);
            return agent;
          }),
          E.mapError((error) => HreaError.fromError(error, 'Failed to create person agent'))
        );

      const updatePerson = (params: {
        id: string;
        name: string;
        note?: string;
      }): E.Effect<Agent, HreaError> =>
        pipe(
          E.sync(() => {
            console.log('hREA Service: Updating person agent:', params);
            const agentIndex = mockAgents.findIndex((a) => a.id === params.id);
            if (agentIndex === -1) {
              throw new Error(`Agent with id ${params.id} not found`);
            }

            mockAgents[agentIndex] = {
              ...mockAgents[agentIndex],
              name: params.name,
              ...(params.note && { note: params.note }),
              revisionId: generateId()
            };

            console.log('hREA Service: Person agent updated:', mockAgents[agentIndex].id);
            return mockAgents[agentIndex];
          }),
          E.mapError((error) => HreaError.fromError(error, 'Failed to update person agent'))
        );

      const createOrganization = (params: {
        name: string;
        note?: string;
      }): E.Effect<Agent, HreaError> =>
        pipe(
          E.sync(() => {
            console.log('hREA Service: Creating organization agent:', params);
            const agent: Agent = {
              id: generateId(),
              name: params.name,
              ...(params.note && { note: params.note }),
              revisionId: generateId()
            };
            mockAgents.push(agent);
            console.log('hREA Service: Organization agent created:', agent.id);
            return agent;
          }),
          E.mapError((error) => HreaError.fromError(error, 'Failed to create organization agent'))
        );

      const updateOrganization = (params: {
        id: string;
        name: string;
        note?: string;
      }): E.Effect<Agent, HreaError> =>
        pipe(
          E.sync(() => {
            console.log('hREA Service: Updating organization agent:', params);
            const agentIndex = mockAgents.findIndex((a) => a.id === params.id);
            if (agentIndex === -1) {
              throw new Error(`Organization agent with id ${params.id} not found`);
            }

            mockAgents[agentIndex] = {
              ...mockAgents[agentIndex],
              name: params.name,
              ...(params.note && { note: params.note }),
              revisionId: generateId()
            };

            console.log('hREA Service: Organization agent updated:', mockAgents[agentIndex].id);
            return mockAgents[agentIndex];
          }),
          E.mapError((error) => HreaError.fromError(error, 'Failed to update organization agent'))
        );

      const getAgent = (id: string): E.Effect<Agent | null, HreaError> =>
        pipe(
          E.sync(() => {
            console.log('hREA Service: Getting agent:', id);
            const agent = mockAgents.find((a) => a.id === id) || null;
            console.log('hREA Service: Agent found:', !!agent);
            return agent;
          }),
          E.mapError((error) => HreaError.fromError(error, 'Failed to get agent'))
        );

      const getAgents = (): E.Effect<Agent[], HreaError> =>
        pipe(
          E.sync(() => {
            console.log('hREA Service: Getting all agents, count:', mockAgents.length);
            return [...mockAgents];
          }),
          E.mapError((error) => HreaError.fromError(error, 'Failed to get agents'))
        );

      const createResourceSpecification = (params: {
        name: string;
        note?: string;
        classifiedAs?: string[];
      }): E.Effect<ResourceSpecification, HreaError> =>
        pipe(
          E.sync(() => {
            console.log('hREA Service: Creating resource specification:', params);
            const resourceSpec: ResourceSpecification = {
              id: generateId(),
              name: params.name,
              ...(params.note && { note: params.note }),
              classifiedAs: params.classifiedAs || ['http://www.productontology.org/id/Service'],
              revisionId: generateId()
            };
            mockResourceSpecifications.push(resourceSpec);
            console.log('hREA Service: Resource specification created:', resourceSpec.id);
            return resourceSpec;
          }),
          E.mapError((error) =>
            HreaError.fromError(error, 'Failed to create resource specification')
          )
        );

      const updateResourceSpecification = (params: {
        id: string;
        name: string;
        note?: string;
        classifiedAs?: string[];
      }): E.Effect<ResourceSpecification, HreaError> =>
        pipe(
          E.sync(() => {
            console.log('hREA Service: Updating resource specification:', params);
            const specIndex = mockResourceSpecifications.findIndex((spec) => spec.id === params.id);
            if (specIndex === -1) {
              throw new Error(`Resource specification with id ${params.id} not found`);
            }

            mockResourceSpecifications[specIndex] = {
              ...mockResourceSpecifications[specIndex],
              name: params.name,
              ...(params.note && { note: params.note }),
              classifiedAs:
                params.classifiedAs || mockResourceSpecifications[specIndex].classifiedAs,
              revisionId: generateId()
            };

            console.log(
              'hREA Service: Resource specification updated:',
              mockResourceSpecifications[specIndex].id
            );
            return mockResourceSpecifications[specIndex];
          }),
          E.mapError((error) =>
            HreaError.fromError(error, 'Failed to update resource specification')
          )
        );

      const deleteResourceSpecification = (params: { id: string }): E.Effect<boolean, HreaError> =>
        pipe(
          E.sync(() => {
            console.log('hREA Service: Deleting resource specification:', params.id);
            const specIndex = mockResourceSpecifications.findIndex((spec) => spec.id === params.id);
            if (specIndex === -1) {
              console.log('hREA Service: Resource specification not found for deletion');
              return false;
            }

            mockResourceSpecifications.splice(specIndex, 1);
            console.log('hREA Service: Resource specification deleted successfully');
            return true;
          }),
          E.mapError((error) =>
            HreaError.fromError(error, 'Failed to delete resource specification')
          )
        );

      const getResourceSpecification = (
        id: string
      ): E.Effect<ResourceSpecification | null, HreaError> =>
        pipe(
          E.sync(() => {
            console.log('hREA Service: Getting resource specification:', id);
            const spec = mockResourceSpecifications.find((spec) => spec.id === id) || null;
            console.log('hREA Service: Resource specification found:', !!spec);
            return spec;
          }),
          E.mapError((error) => HreaError.fromError(error, 'Failed to get resource specification'))
        );

      const getResourceSpecifications = (): E.Effect<ResourceSpecification[], HreaError> =>
        pipe(
          E.sync(() => {
            console.log(
              'hREA Service: Getting all resource specifications, count:',
              mockResourceSpecifications.length
            );
            return [...mockResourceSpecifications];
          }),
          E.mapError((error) => HreaError.fromError(error, 'Failed to get resource specifications'))
        );

      const getResourceSpecificationsByClassification = (
        classifiedAs: string[]
      ): E.Effect<ResourceSpecification[], HreaError> =>
        pipe(
          E.sync(() => {
            console.log(
              'hREA Service: Getting resource specifications by classification:',
              classifiedAs
            );
            const filtered = mockResourceSpecifications.filter((spec) =>
              classifiedAs.some((classification) => spec.classifiedAs?.includes(classification))
            );
            console.log('hREA Service: Filtered resource specifications count:', filtered.length);
            return filtered;
          }),
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
        getResourceSpecificationsByClassification
      });
    })
  );
