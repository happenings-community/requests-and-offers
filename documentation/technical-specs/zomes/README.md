# Zome Specifications

This section provides detailed specifications for each Holochain zome within the DNA.

For a higher-level overview of the system's technical foundation, see the main [Technical Specifications](../technical-specs.md).

## Zomes

- **[Users & Organizations](./users_organizations.md)**: Manages user profiles, organization profiles, and their relationships.
  - *Includes details split into [User Management](./users.md) and [Organization Management](./organizations.md).*
- **[Service Types](./service_types.md)**: Manages the definition, validation workflow (pending, approved, rejected), and tag-based indexing of service types used in requests and offers.
- **[Requests](./requests.md)**: Handles the creation, management, and lifecycle of requests, integrating with the Service Types zome for defining the nature of requests using approved service types.
- **[Offers](./offers.md)**: Handles the creation, management, and lifecycle of offers, integrating with the Service Types zome for defining capabilities offered using approved service types.
- **[Administration](./administration.md)**: Covers administrator roles, status management, entity verification, and system moderation.
- **[Exchanges](./exchanges.md)**: Manages exchange proposals, agreements, completion validation, and exchange lifecycle between parties.
- **[Mediums of Exchange](./mediums_of_exchange.md)**: Handles currency definitions, payment methods, and medium of exchange management for transactions.

---

*(Internal Note: Guidelines below are for maintaining documentation consistency)*

## Documentation Structure

Each zome's documentation follows this structure:

1. Overview
2. Technical Implementation
   - Entry Types
   - Link Types
   - Core Functions
3. Validation Rules
4. Access Control
5. Integration Points
6. Usage Examples

## Development Guidelines

1. **Function Documentation**:
   - Document all public functions
   - Include parameter and return type descriptions
   - Provide error conditions and handling

2. **Link Types**:
   - Document all link types
   - Explain link creation conditions
   - Describe link validation rules

3. **Entry Types**:
   - Document all entry fields
   - Include validation rules
   - Provide example entries

4. **Examples**:
   - Show common use cases
   - Include error handling
   - Demonstrate integration points
