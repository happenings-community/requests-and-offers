import { gql } from '@apollo/client/core';

// GraphQL mutation for creating a Person agent in hREA
export const CREATE_PERSON_MUTATION = gql`
  mutation CreatePerson($person: AgentCreateParams!) {
    createPerson(person: $person) {
      agent {
        id
        name
        note
      }
    }
  }
`;

// GraphQL mutation for updating a Person agent in hREA
export const UPDATE_PERSON_MUTATION = gql`
  mutation UpdatePerson($id: ID!, $person: AgentUpdateParams!) {
    updatePerson(id: $id, person: $person) {
      agent {
        id
        name
        note
        revisionId
      }
    }
  }
`;

// GraphQL mutation for creating an Organization agent in hREA
export const CREATE_ORGANIZATION_MUTATION = gql`
  mutation CreateOrganization($organization: AgentCreateParams!) {
    createOrganization(organization: $organization) {
      agent {
        id
        name
        note
      }
    }
  }
`;

// GraphQL mutation for updating an Organization agent in hREA
export const UPDATE_ORGANIZATION_MUTATION = gql`
  mutation UpdateOrganization($id: ID!, $organization: AgentUpdateParams!) {
    updateOrganization(id: $id, organization: $organization) {
      agent {
        id
        name
        note
        revisionId
      }
    }
  }
`;
