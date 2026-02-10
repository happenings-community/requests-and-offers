import { gql } from '@apollo/client/core';

// GraphQL mutation for creating a Proposal in hREA
export const CREATE_PROPOSAL_MUTATION = gql`
  mutation CreateProposal($proposal: ProposalCreateParams!) {
    createProposal(proposal: $proposal) {
      proposal {
        id
        name
        note
        created
        revisionId
        hasBeginning
        hasEnd
        unitBased
      }
    }
  }
`;

// GraphQL mutation for updating a Proposal in hREA
export const UPDATE_PROPOSAL_MUTATION = gql`
  mutation UpdateProposal($proposal: ProposalUpdateParams!) {
    updateProposal(proposal: $proposal) {
      proposal {
        id
        name
        note
        created
        revisionId
        hasBeginning
        hasEnd
        unitBased
      }
    }
  }
`;

// GraphQL mutation for deleting a Proposal in hREA
export const DELETE_PROPOSAL_MUTATION = gql`
  mutation DeleteProposal($revisionId: ID!) {
    deleteProposal(revisionId: $revisionId)
  }
`;
