import { gql } from '@apollo/client/core';

// Fragment for Intent core fields (enriched with CFN-verified structure)
export const INTENT_FRAGMENT = gql`
  fragment IntentFragment on Intent {
    id
    revisionId
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
    note
  }
`;

// Fragment for Intent with additional details and relationships
export const INTENT_DETAILED_FRAGMENT = gql`
  fragment IntentDetailedFragment on Intent {
    id
    revisionId
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
    note
  }
`;
