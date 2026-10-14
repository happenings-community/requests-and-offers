import { gql } from '@apollo/client/core';

// GraphQL mutation for creating a Unit in hREA.
// UnitCreateParams requires label, symbol, and omUnitIdentifier (OM2).
export const CREATE_UNIT_MUTATION = gql`
  mutation CreateUnit($unit: UnitCreateParams!) {
    createUnit(unit: $unit) {
      unit {
        id
        revisionId
        label
        symbol
        omUnitIdentifier
      }
    }
  }
`;

// Query to retrieve all units
export const GET_UNITS_QUERY = gql`
  query GetUnits {
    units {
      edges {
        node {
          id
          revisionId
          label
          symbol
          omUnitIdentifier
        }
      }
    }
  }
`;
