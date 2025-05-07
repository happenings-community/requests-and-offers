# Offers Zome

## Overview

The Offers zome provides core functionality for creating, managing, and finding support offers in the Requests and Offers application. Offers represent capabilities, skills, or resources that users, projects, or organizations can provide to other members of the community.

## Technical Implementation

The Offers zome is implemented in two parts:

- **Integrity:** `dnas/requests_and_offers/zomes/integrity/offers`
- **Coordinator:** `dnas/requests_and_offers/zomes/coordinator/offers`

### Entry Types

#### Offer

The `Offer` entry represents an offer of support or resources with the following structure:

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Offer {
  /// The title of the offer
  pub title: String,
  /// A detailed description of the offer (max 500 characters)
  pub description: String,
  /// The capabilities or skills being offered
  pub capabilities: Vec<String>,
  /// Preferred time of day for the work/interaction
  pub time_preference: TimePreference,
  /// The offerer's time zone
  pub time_zone: Option<TimeZone>,
  /// Preferred method of exchange (Exchange, Arranged, PayItForward, Open)
  pub exchange_preference: ExchangePreference,
  /// Type of interaction offered (Virtual, InPerson)
  pub interaction_type: InteractionType,
  /// Additional links or resources related to the offer
  pub links: Vec<String>,
}
```

Where the supporting types are defined as:

```rust
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum TimePreference { 
  Morning, 
  Afternoon, 
  Evening, 
  NoPreference, 
  Other 
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ExchangePreference { 
  Exchange, 
  Arranged, 
  PayItForward, 
  Open 
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum InteractionType { 
  Virtual, 
  InPerson 
}

// TimeZone is implemented as a String
pub type TimeZone = String;
```

### Link Types

The following link types are used to create relationships between offers and other entries:

- **AllOffers**: Links from an "offers" path to all offer entries
- **UserOffers**: Links from a user profile to the offers created by that user
- **OrganizationOffers**: Links from an organization to offers associated with it
- **OfferCreator**: Links from an offer to its creator user profile
- **OfferOrganization**: Links from an offer to its associated organization (if any)
- **OfferUpdates**: Links from the original offer action to update actions

## Core Functions

### Create Offer

```rust
pub fn create_offer(input: OfferInput) -> ExternResult<Record>
```

Creates a new offer entry with the provided information.

**Parameters:**

- `input`: An `OfferInput` struct containing:
  - `offer`: The offer data
  - `organization`: Optional organization hash to associate with the offer

**Returns:**

- `Record`: The created offer record
- `Error`: If creation fails

**Access Control:**

- Requires a valid user profile for the agent

### Get Latest Offer Record

```rust
pub fn get_latest_offer_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>>
```

Retrieves the latest record for an offer, following any update links.

**Parameters:**

- `original_action_hash`: The original action hash of the offer

**Returns:**

- `Option<Record>`: The latest offer record if found, None otherwise

### Get Latest Offer

```rust
pub fn get_latest_offer(original_action_hash: ActionHash) -> ExternResult<Offer>
```

Retrieves the latest offer entry data.

**Parameters:**

- `original_action_hash`: The original action hash of the offer

**Returns:**

- `Offer`: The latest offer data
- `Error`: If offer is not found or cannot be deserialized

### Update Offer

```rust
pub fn update_offer(input: UpdateOfferInput) -> ExternResult<Record>
```

Updates an existing offer with new data.

**Parameters:**

- `input`: An `UpdateOfferInput` struct containing:
  - `original_action_hash`: The original action hash
  - `previous_action_hash`: The most recent action hash
  - `updated_offer`: The updated offer data

**Returns:**

- `Record`: The updated offer record
- `Error`: If update fails

**Access Control:**

- Only the original author or an administrator can update an offer

### Delete Offer

```rust
pub fn delete_offer(original_action_hash: ActionHash) -> ExternResult<Record>
```

Deletes an offer and all associated links.

**Parameters:**

- `original_action_hash`: The action hash of the offer to delete

**Returns:**

- `Record`: The deleted offer record
- `Error`: If deletion fails

**Access Control:**

- Only the original author or an administrator can delete an offer

### Get All Offers

```rust
pub fn get_all_offers(_: ()) -> ExternResult<Vec<Record>>
```

Retrieves all offers in the system.

**Parameters:**

- None (empty tuple)

**Returns:**

- `Vec<Record>`: Array of all offer records
- `Error`: If retrieval fails

### Get User Offers

```rust
pub fn get_user_offers(user_hash: ActionHash) -> ExternResult<Vec<Record>>
```

Retrieves all offers created by a specific user.

**Parameters:**

- `user_hash`: The action hash of the user profile

**Returns:**

- `Vec<Record>`: Array of offer records created by the user
- `Error`: If retrieval fails

### Get Organization Offers

```rust
pub fn get_organization_offers(organization_hash: ActionHash) -> ExternResult<Vec<Record>>
```

Retrieves all offers associated with a specific organization.

**Parameters:**

- `organization_hash`: The action hash of the organization

**Returns:**

- `Vec<Record>`: Array of offer records associated with the organization
- `Error`: If retrieval fails

### Get Offer Creator

```rust
pub fn get_offer_creator(offer_hash: ActionHash) -> ExternResult<Option<ActionHash>>
```

Retrieves the creator of an offer.

**Parameters:**

- `offer_hash`: The action hash of the offer

**Returns:**

- `Option<ActionHash>`: The action hash of the creator user profile, if found
- `Error`: If retrieval fails

### Get Offer Organization

```rust
pub fn get_offer_organization(offer_hash: ActionHash) -> ExternResult<Option<ActionHash>>
```

Retrieves the organization associated with an offer, if any.

**Parameters:**

- `offer_hash`: The action hash of the offer

**Returns:**

- `Option<ActionHash>`: The action hash of the associated organization, if any
- `Error`: If retrieval fails

## Validation Rules

### Offer Validation

- Title cannot be empty
- Description cannot be empty and must be 500 characters or less
- At least one capability must be specified
- Time preference must be specified
- Exchange preference must be specified
- Interaction type must be specified
- Links array must be present (can be empty)

## Client Integration

The UI integrates with the Offers zome through service and store layers:

### Offers Service

The `OffersService` provides direct methods for interacting with the Holochain backend:

```typescript
export type OffersService = {
  createOffer: (offer: OfferInDHT, organizationHash?: ActionHash) => Effect<never, OfferError, Record>;
  getLatestOfferRecord: (originalActionHash: ActionHash) => Effect<never, OfferError, Record | null>;
  getLatestOffer: (originalActionHash: ActionHash) => Effect<never, OfferError, OfferInDHT | null>;
  updateOffer: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedOffer: OfferInDHT
  ) => Effect<never, OfferError, Record>;
  getAllOffersRecords: () => Effect<never, OfferError, Record[]>;
  getUserOffersRecords: (userHash: ActionHash) => Effect<never, OfferError, Record[]>;
  getOrganizationOffersRecords: (organizationHash: ActionHash) => Effect<never, OfferError, Record[]>;
  deleteOffer: (offerHash: ActionHash) => Effect<never, OfferError, void>;
};
```

### Offers Store

The `OffersStore` provides a reactive state layer with caching, error handling, and event integration:

```typescript
export type OffersStore = {
  readonly offers: UIOffer[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCache<UIOffer>;
  getLatestOffer: (originalActionHash: ActionHash) => Effect<never, OfferStoreError, UIOffer | null>;
  getAllOffers: () => Effect<never, OfferStoreError, UIOffer[]>;
  getUserOffers: (userHash: ActionHash) => Effect<never, OfferStoreError, UIOffer[]>;
  getOrganizationOffers: (organizationHash: ActionHash) => Effect<never, OfferStoreError, UIOffer[]>;
  createOffer: (offer: OfferInDHT, organizationHash?: ActionHash) => Effect<never, OfferStoreError, Record>;
  updateOffer: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedOffer: OfferInDHT
  ) => Effect<never, OfferStoreError, Record>;
  deleteOffer: (offerHash: ActionHash) => Effect<never, OfferStoreError, void>;
  invalidateCache: () => void;
};
```

## hREA Integration

Offers are designed to integrate with the hREA economic model as follows:

- Offers are mapped to hREA Intents
- Capabilities (skills) are mapped to hREA ResourceSpecifications
- Offer process states align with hREA economic process states

## Usage Examples

### Creating an Offer

```typescript
// Using the offers store
const newOffer: OfferInDHT = {
  title: "Development assistance available",
  description: "Can help with Holochain DNA implementation",
  capabilities: ["Rust", "Holochain"],
  availability: "Weekends"
};

// For a personal offer
const result = await pipe(
  offersStore.createOffer(newOffer),
  E.runPromise
);

// For an organization offer
const result = await pipe(
  offersStore.createOffer(newOffer, organizationHash),
  E.runPromise
);
```

### Getting All Offers

```typescript
// Using the offers store
const allOffers = await pipe(
  offersStore.getAllOffers(),
  E.runPromise
);
```

### Updating an Offer

```typescript
// Using the offers store
const updatedOffer: OfferInDHT = {
  ...existingOffer,
  title: "Updated title",
  description: "Updated description"
};

const result = await pipe(
  offersStore.updateOffer(
    existingOffer.original_action_hash,
    existingOffer.previous_action_hash,
    updatedOffer
  ),
  E.runPromise
);
```

### Deleting an Offer

```typescript
// Using the offers store
await pipe(
  offersStore.deleteOffer(offerHash),
  E.runPromise
);
```
