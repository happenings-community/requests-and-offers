import { gql } from '@apollo/client/core';
import { RESOURCE_SPECIFICATION_FRAGMENT } from '../fragments/resourceSpecification.fragments';

// Query to retrieve a single resource specification by ID
export const GET_RESOURCE_SPECIFICATION_QUERY = gql`
  ${RESOURCE_SPECIFICATION_FRAGMENT}
  query GetResourceSpecification($id: ID!) {
    resourceSpecification(id: $id) {
      ...ResourceSpecificationFragment
    }
  }
`;

// Query to retrieve all resource specifications
export const GET_RESOURCE_SPECIFICATIONS_QUERY = gql`
  ${RESOURCE_SPECIFICATION_FRAGMENT}
  query GetResourceSpecifications {
    resourceSpecifications {
      edges {
        node {
          ...ResourceSpecificationFragment
        }
      }
    }
  }
`;

// Query to retrieve resource specifications filtered by classification
export const GET_RESOURCE_SPECIFICATIONS_BY_CLASS_QUERY = gql`
  ${RESOURCE_SPECIFICATION_FRAGMENT}
  query GetResourceSpecificationsByClass($classifiedAs: [URI!]) {
    resourceSpecifications(filter: { classifiedAs: $classifiedAs }) {
      edges {
        node {
          ...ResourceSpecificationFragment
        }
      }
    }
  }
`;
