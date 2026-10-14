import { gql } from '@apollo/client/core';
import { INTENT_FRAGMENT } from './intent.fragments';

// Fragment for Proposal core fields (enriched with intent relationships)
export const PROPOSAL_FRAGMENT = gql`
  ${INTENT_FRAGMENT}
  fragment ProposalFragment on Proposal {
    id
    name
    note
    created
    revisionId
    hasBeginning
    hasEnd
    unitBased
    publishes {
      ...IntentFragment
    }
    reciprocal {
      ...IntentFragment
    }
  }
`;

// Fragment for Proposal with additional details and relationships
export const PROPOSAL_DETAILED_FRAGMENT = gql`
  ${INTENT_FRAGMENT}
  fragment ProposalDetailedFragment on Proposal {
    id
    name
    note
    created
    revisionId
    hasBeginning
    hasEnd
    unitBased
    publishes {
      ...IntentFragment
    }
    reciprocal {
      ...IntentFragment
    }
  }
`;
