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
