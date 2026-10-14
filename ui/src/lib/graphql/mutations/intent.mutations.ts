import { gql } from '@apollo/client/core';

// GraphQL mutation for creating an Intent in hREA
export const CREATE_INTENT_MUTATION = gql`
  mutation CreateIntent($intent: IntentCreateParams!) {
    createIntent(intent: $intent) {
      intent {
        id
        action {
          id
        }
        provider {
          id
          name
        }
        receiver {
          id
          name
        }
        resourceConformsTo {
          id
          name
        }
        resourceQuantity {
          hasNumericalValue
          hasUnit {
            id
            label
            symbol
          }
        }
        revisionId
        note
      }
    }
  }
`;

// GraphQL mutation for linking an Intent to a Proposal (publishedIn relationship)
export const PROPOSE_INTENT_MUTATION = gql`
  mutation ProposeIntent($publishedIn: ID!, $publishes: ID!, $reciprocal: Boolean) {
    proposeIntent(publishedIn: $publishedIn, publishes: $publishes, reciprocal: $reciprocal) {
      proposedIntent {
        id
        reciprocal
        publishedIn {
          id
          name
        }
        publishes {
          id
          action {
            id
          }
        }
      }
    }
  }
`;

// GraphQL mutation for updating an Intent in hREA
export const UPDATE_INTENT_MUTATION = gql`
  mutation UpdateIntent($intent: IntentUpdateParams!) {
    updateIntent(intent: $intent) {
      intent {
        id
        action {
          id
        }
        provider {
          id
          name
        }
        receiver {
          id
          name
        }
        resourceConformsTo {
          id
          name
        }
        resourceQuantity {
          hasNumericalValue
          hasUnit {
            id
            label
            symbol
          }
        }
        revisionId
        note
      }
    }
  }
`;

// GraphQL mutation for deleting an Intent in hREA
export const DELETE_INTENT_MUTATION = gql`
  mutation DeleteIntent($revisionId: ID!) {
    deleteIntent(revisionId: $revisionId)
  }
`;
