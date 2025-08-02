import { gql } from '@apollo/client/core';

// Fragment for Intent core fields
export const INTENT_FRAGMENT = gql`
  fragment IntentFragment on Intent {
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
`;

// Fragment for Intent with additional details and relationships
export const INTENT_DETAILED_FRAGMENT = gql`
  fragment IntentDetailedFragment on Intent {
    id
    action
    provider {
      id
      name
      note
    }
    receiver {
      id
      name
      note
    }
    resourceSpecifiedBy {
      id
      name
      note
      classifiedAs
    }
    resourceQuantity {
      hasNumericalValue
      hasUnit {
        id
        label
        symbol
      }
    }
    publishedIn {
      id
      name
    }
    revisionId
  }
`;