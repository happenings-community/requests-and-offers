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

// TODO: Add additional agent-related mutations (e.g., createOrganization) as the integration progresses.
