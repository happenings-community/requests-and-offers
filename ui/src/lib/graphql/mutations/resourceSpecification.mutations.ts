import { gql } from '@apollo/client/core';
import { RESOURCE_SPECIFICATION_FRAGMENT } from '../fragments/resourceSpecification.fragments';

// GraphQL mutation for creating a ResourceSpecification in hREA
export const CREATE_RESOURCE_SPECIFICATION_MUTATION = gql`
  ${RESOURCE_SPECIFICATION_FRAGMENT}
  mutation CreateResourceSpecification($resourceSpecification: ResourceSpecificationCreateParams!) {
    createResourceSpecification(resourceSpecification: $resourceSpecification) {
      resourceSpecification {
        ...ResourceSpecificationFragment
      }
    }
  }
`;

// GraphQL mutation for updating a ResourceSpecification in hREA
export const UPDATE_RESOURCE_SPECIFICATION_MUTATION = gql`
  ${RESOURCE_SPECIFICATION_FRAGMENT}
  mutation UpdateResourceSpecification(
    $id: ID!
    $resourceSpecification: ResourceSpecificationUpdateParams!
  ) {
    updateResourceSpecification(id: $id, resourceSpecification: $resourceSpecification) {
      resourceSpecification {
        ...ResourceSpecificationFragment
      }
    }
  }
`;

// GraphQL mutation for deleting a ResourceSpecification in hREA
export const DELETE_RESOURCE_SPECIFICATION_MUTATION = gql`
  mutation DeleteResourceSpecification($id: ID!) {
    deleteResourceSpecification(id: $id)
  }
`;
