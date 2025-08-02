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
        eligible
        revisionId
      }
    }
  }
`;

// GraphQL mutation for updating a Proposal in hREA
export const UPDATE_PROPOSAL_MUTATION = gql`
  mutation UpdateProposal($id: ID!, $proposal: ProposalUpdateParams!) {
    updateProposal(id: $id, proposal: $proposal) {
      proposal {
        id
        name
        note
        created
        eligible
        revisionId
      }
    }
  }
`;

// GraphQL mutation for deleting a Proposal in hREA (if needed for cleanup)
export const DELETE_PROPOSAL_MUTATION = gql`
  mutation DeleteProposal($id: ID!) {
    deleteProposal(id: $id)
  }
`;