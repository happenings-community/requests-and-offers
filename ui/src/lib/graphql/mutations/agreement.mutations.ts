import { gql } from '@apollo/client/core';

// Fields follow node_modules/@valueflows/vf-graphql/schemas: agreement.gql,
// commitment.gql plus its agent, agreement and resource_specification
// bridging, and observation.gql plus the same bridging.

export const CREATE_AGREEMENT_MUTATION = gql`
  mutation CreateAgreement($agreement: AgreementCreateParams!) {
    createAgreement(agreement: $agreement) {
      agreement {
        id
        revisionId
        name
        note
        created
      }
    }
  }
`;

export const CREATE_COMMITMENT_MUTATION = gql`
  mutation CreateCommitment($commitment: CommitmentCreateParams!) {
    createCommitment(commitment: $commitment) {
      commitment {
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
`;

export const UPDATE_COMMITMENT_MUTATION = gql`
  mutation UpdateCommitment($commitment: CommitmentUpdateParams!) {
    updateCommitment(commitment: $commitment) {
      commitment {
        id
        revisionId
        finished
      }
    }
  }
`;

export const CREATE_ECONOMIC_EVENT_MUTATION = gql`
  mutation CreateEconomicEvent($event: EconomicEventCreateParams!) {
    createEconomicEvent(event: $event) {
      economicEvent {
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
`;
