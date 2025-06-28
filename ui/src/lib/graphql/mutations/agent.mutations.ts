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

// TODO: Add additional agent-related mutations (e.g., updatePerson, createOrganization) as the integration progresses.
