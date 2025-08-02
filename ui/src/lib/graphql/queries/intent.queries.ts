import { gql } from '@apollo/client/core';
import { INTENT_FRAGMENT, INTENT_DETAILED_FRAGMENT } from '../fragments/intent.fragments';

// Query to retrieve a single intent by ID
export const GET_INTENT_QUERY = gql`
  ${INTENT_DETAILED_FRAGMENT}
  query GetIntent($id: ID!) {
    intent(id: $id) {
      ...IntentDetailedFragment
    }
  }
`;

// Query to retrieve all intents
export const GET_INTENTS_QUERY = gql`
  ${INTENT_FRAGMENT}
  query GetIntents {
    intents {
      edges {
        node {
          ...IntentFragment
        }
      }
    }
  }
`;

// Query to retrieve intents within a specific proposal
export const GET_INTENTS_BY_PROPOSAL_QUERY = gql`
  ${INTENT_FRAGMENT}
  query GetIntentsByProposal($proposalId: ID!) {
    intents(filter: { publishedIn: $proposalId }) {
      edges {
        node {
          ...IntentFragment
        }
      }
    }
  }
`;