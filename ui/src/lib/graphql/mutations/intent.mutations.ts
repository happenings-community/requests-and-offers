import { gql } from '@apollo/client/core';

// GraphQL mutation for creating an Intent in hREA
export const CREATE_INTENT_MUTATION = gql`
  mutation CreateIntent($intent: IntentCreateParams!) {
    createIntent(intent: $intent) {
      intent {
        id
        action
        provider {
          id
          name
        }
        receiver {
          id
          name
        }
        resourceSpecifiedBy {
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
      }
    }
  }
`;

// GraphQL mutation for linking an Intent to a Proposal (publishedIn relationship)
export const PROPOSE_INTENT_MUTATION = gql`
  mutation ProposeIntent($publishedIn: ID!, $publishes: ID!) {
    proposeIntent(publishedIn: $publishedIn, publishes: $publishes) {
      proposedIntent {
        id
        publishedIn {
          id
          name
        }
        publishes {
          id
          action
        }
      }
    }
  }
`;

// GraphQL mutation for updating an Intent in hREA
export const UPDATE_INTENT_MUTATION = gql`
  mutation UpdateIntent($id: ID!, $intent: IntentUpdateParams!) {
    updateIntent(id: $id, intent: $intent) {
      intent {
        id
        action
        provider {
          id
          name
        }
        receiver {
          id
          name
        }
        resourceSpecifiedBy {
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
      }
    }
  }
`;

// GraphQL mutation for deleting an Intent in hREA
export const DELETE_INTENT_MUTATION = gql`
  mutation DeleteIntent($id: ID!) {
    deleteIntent(id: $id)
  }
`;