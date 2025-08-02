import { gql } from '@apollo/client/core';

// Fragment for Proposal core fields
export const PROPOSAL_FRAGMENT = gql`
  fragment ProposalFragment on Proposal {
    id
    name
    note
    created
    eligible
    revisionId
  }
`;

// Fragment for Proposal with additional details and relationships
export const PROPOSAL_DETAILED_FRAGMENT = gql`
  fragment ProposalDetailedFragment on Proposal {
    id
    name
    note
    created
    eligible
    revisionId
    publishedIn {
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
    }
  }
`;