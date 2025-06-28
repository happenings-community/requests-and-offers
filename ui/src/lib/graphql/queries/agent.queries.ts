import { gql } from '@apollo/client/core';

// Query to retrieve a single agent by ID
export const GET_AGENT_QUERY = gql`
  query GetAgent($id: ID!) {
    agent(id: $id) {
      id
      name
      note
    }
  }
`;

// Query to retrieve all agents
export const GET_AGENTS_QUERY = gql`
  query GetAgents {
    agents {
      id
      name
      note
    }
  }
`;
