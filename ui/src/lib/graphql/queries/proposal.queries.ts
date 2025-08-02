import { gql } from '@apollo/client/core';
import { PROPOSAL_FRAGMENT, PROPOSAL_DETAILED_FRAGMENT } from '../fragments/proposal.fragments';

// Query to retrieve a single proposal by ID
export const GET_PROPOSAL_QUERY = gql`
  ${PROPOSAL_DETAILED_FRAGMENT}
  query GetProposal($id: ID!) {
    proposal(id: $id) {
      ...ProposalDetailedFragment
    }
  }
`;

// Query to retrieve all proposals
export const GET_PROPOSALS_QUERY = gql`
  ${PROPOSAL_FRAGMENT}
  query GetProposals {
    proposals {
      edges {
        node {
          ...ProposalFragment
        }
      }
    }
  }
`;

// Query to retrieve proposals for a specific agent
export const GET_PROPOSALS_BY_AGENT_QUERY = gql`
  ${PROPOSAL_FRAGMENT}
  query GetProposalsByAgent($agentId: ID!) {
    proposals(filter: { eligible: [$agentId] }) {
      edges {
        node {
          ...ProposalFragment
        }
      }
    }
  }
`;