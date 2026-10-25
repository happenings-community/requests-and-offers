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
- **[Exchanges](./exchanges.md)**: Records an exchange as six append-only entries (Interest, Agreement, Response, Completion, Review, Cancellation) whose state is derived from which of them exist rather than stored. The reasoning behind that shape is in the [architecture note](../../architecture/EXCHANGE_RECORD.md).
- **[Messaging](./messaging.md)**: The signal layer. A nudge tells other agents that something addressed to them exists at an `ActionHash`; it carries the hash and never content, and the stored data stays the record. Coordinator only, so it does not change the DNA hash.
- **[Mediums of Exchange](./mediums_of_exchange.md)**: Manages payment methods and value exchange mechanisms with approval workflow, supporting both traditional currencies and alternative exchange systems (time banking, LETS, etc.).

## Link rules (#234)

Every link type has a rule in three parts. The parts live in `dnas/requests_and_offers/utils/src/links.rs`; each zome's `links.rs` (or, for administration and exchanges, its `lib.rs`) assigns them.

- **Shape.** A link's base and target are what its type declares: an agent key, one of its named paths, or a record that writes a named entry type. The tag is empty, except where a type declares otherwise:
  - the approved and rejected status paths of service types and mediums of exchange carry the administrator's grant;
  - the grants stack's roster and membership links carry a grant;
  - `OrganizationContacts` carries the contact's role as 1 to 100 bytes of text.
- **Writer.** The author of the record the link hangs from. Where a role acts for someone else, the tag names the writer's grant, checked with `check_act`.
- **Tombstone.** A `DeleteLink` writes a tombstone; nothing is erased. Link types nothing tombstones refuse every tombstone. `AllOffers` and `AllRequests`, which nothing writes, refuse every create.

**Still open, and stated beside each type:** the writer and tombstone rules where a role holder acts on someone else's link with no grant in the tag. These are status paths, active listings, listing relations and membership. They close when status is held in entries (#234 phase 2).

The full inventory, one row per link type, is in the first comment on #234.

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
