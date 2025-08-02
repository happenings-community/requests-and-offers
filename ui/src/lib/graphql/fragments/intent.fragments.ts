import { gql } from '@apollo/client/core';

// Fragment for Intent core fields (simplified for compatibility)
export const INTENT_FRAGMENT = gql`
  fragment IntentFragment on Intent {
    id
    action
    revisionId
  }
`;

// Fragment for Intent with additional details and relationships (simplified for compatibility)
export const INTENT_DETAILED_FRAGMENT = gql`
  fragment IntentDetailedFragment on Intent {
    id
    action
    revisionId
  }
`;
