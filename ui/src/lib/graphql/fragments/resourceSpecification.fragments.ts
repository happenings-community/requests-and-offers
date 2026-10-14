import { gql } from '@apollo/client/core';

// Fragment for ResourceSpecification core fields
export const RESOURCE_SPECIFICATION_FRAGMENT = gql`
  fragment ResourceSpecificationFragment on ResourceSpecification {
    id
    name
    note
    revisionId
  }
`;

// Fragment for ResourceSpecification with additional details
export const RESOURCE_SPECIFICATION_DETAILED_FRAGMENT = gql`
  fragment ResourceSpecificationDetailedFragment on ResourceSpecification {
    id
    name
    note
    revisionId
    # Add any additional fields that might be useful for detailed views
  }
`;
