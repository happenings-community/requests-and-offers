import { gql } from '@apollo/client/core';

// List reads for the admin hREA dashboard (U14). The field sets match what
// agreement.mutations.ts selects, so the same normalizers apply.

export const GET_AGREEMENTS_QUERY = gql`
  query GetAgreements {
    agreements {
      edges {
        node {
          id
          revisionId
          name
          note
          created
        }
      }
    }
  }
`;

export const GET_COMMITMENTS_QUERY = gql`
  query GetCommitments {
    commitments {
      edges {
        node {
          id
          revisionId
          action {
            id
          }
          provider {
            id
          }
          receiver {
            id
          }
          resourceConformsTo {
            id
          }
          resourceQuantity {
            hasNumericalValue
            hasUnit {
              id
            }
          }
          due
          finished
          note
          agreedIn
          clauseOf {
            id
          }
        }
      }
    }
  }
`;

export const GET_ECONOMIC_EVENTS_QUERY = gql`
  query GetEconomicEvents {
    economicEvents {
      edges {
        node {
          id
          revisionId
          action {
            id
          }
          provider {
            id
          }
          receiver {
            id
          }
          resourceConformsTo {
            id
          }
          resourceQuantity {
            hasNumericalValue
            hasUnit {
              id
            }
          }
          hasPointInTime
          note
          agreedIn
          realizationOf {
            id
          }
        }
      }
    }
  }
`;
