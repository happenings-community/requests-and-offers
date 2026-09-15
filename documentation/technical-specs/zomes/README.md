# Zome Specifications

This section provides detailed specifications for each Holochain zome within the DNA.

For a higher-level overview of the system's technical foundation, see the main [Technical Specifications](../technical-specs.md).

## Zomes

- **[Users & Organizations](./users_organizations.md)**: Manages user profiles, organization profiles, and their relationships.
  - _Includes details split into [User Management](./users.md) and [Organization Management](./organizations.md)._
- **[Service Types](./service_types.md)**: Manages the definition, validation workflow (pending, approved, rejected), and tag-based indexing of service types used in requests and offers.
- **[Requests](./requests.md)**: Handles the creation, management, and lifecycle of requests, integrating with the Service Types zome for defining the nature of requests using approved service types.
- **[Offers](./offers.md)**: Handles the creation, management, and lifecycle of offers, integrating with the Service Types zome for defining capabilities offered using approved service types.
- **[Administration](./administration.md)**: Covers administrator roles, status management, entity verification, and system moderation.
- **[Exchanges](../../architecture/EXCHANGE_RECORD.md)**: Records an exchange as six append-only entries (Interest, Agreement, Response, Completion, Review, Cancellation) whose state is derived from which of them exist rather than stored. Specified in the architecture note until a zome spec of its own is written.
- **[Mediums of Exchange](./mediums_of_exchange.md)**: Manages payment methods and value exchange mechanisms with approval workflow, supporting both traditional currencies and alternative exchange systems (time banking, LETS, etc.).

---

_(Internal Note: Guidelines below are for maintaining documentation consistency)_

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
