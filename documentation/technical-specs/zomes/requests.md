# Requests Zome

## Overview

The Requests zome provides core functionality for creating, managing, and finding support requests in the Requests and Offers application. Requests represent needs expressed by users, projects, or organizations seeking assistance, skills, or resources from other members of the community.

## Technical Implementation

The Requests zome is implemented in two parts:

- **Integrity:** `dnas/requests_and_offers/zomes/integrity/requests`
- **Coordinator:** `dnas/requests_and_offers/zomes/coordinator/requests`

### Entry Types

#### Request

The `Request` entry represents a request for support or resources with the following structure:

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Request {
  /// The title of the request
  pub title: String,
  /// A detailed description of the request (max 500 characters)
  pub description: String,
  /// The requirements associated with the request (Type of Service or Skill needed)
  pub requirements: Vec<String>,
  /// How the requester prefers to be contacted (Email, Phone, Other)
  pub contact_preference: ContactPreference,
  /// The date range when the request is valid/needed
  pub date_range: Option<DateRange>,
  /// Estimated time needed in hours
  pub time_estimate_hours: Option<f32>,
  /// Preferred time of day for the work/interaction
  pub time_preference: TimePreference,
  /// The requester's time zone
  pub time_zone: Option<TimeZone>,
  /// Preferred method of exchange (Exchange, Arranged, PayItForward, Open)
  pub exchange_preference: ExchangePreference,
  /// Type of interaction preferred (Virtual, InPerson)
  pub interaction_type: InteractionType,
  /// Additional links or resources related to the request
  pub links: Vec<String>,
}
```

Where the supporting types are defined as:

```rust
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ContactPreference { 
  Email, 
  Phone, 
  Other 
}

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

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DateRange {
  pub start: Option<Timestamp>,
  pub end: Option<Timestamp>,
}

// TimeZone is implemented as a String
pub type TimeZone = String;
```

### Link Types

The following link types are used to create relationships between requests and other entries:

- **AllRequests**: Links from a "requests" path to all request entries
- **UserRequests**: Links from a user profile to the requests created by that user
- **OrganizationRequests**: Links from an organization to requests associated with it
- **RequestCreator**: Links from a request to its creator user profile
- **RequestOrganization**: Links from a request to its associated organization (if any)
- **RequestUpdates**: Links from the original request action to update actions

## Core Functions

### Create Request

```rust
pub fn create_request(input: RequestInput) -> ExternResult<Record>
```

Creates a new request entry with the provided information.

**Parameters:**

- `input`: A `RequestInput` struct containing:
  - `request`: The request data
  - `organization`: Optional organization hash to associate with the request

**Returns:**

- `Record`: The created request record
- `Error`: If creation fails

**Access Control:**

- Requires a valid user profile for the agent

### Get Latest Request Record

```rust
pub fn get_latest_request_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>>
```

Retrieves the latest record for a request, following any update links.

**Parameters:**

- `original_action_hash`: The original action hash of the request

**Returns:**

- `Option<Record>`: The latest request record if found, None otherwise

### Get Latest Request

```rust
pub fn get_latest_request(original_action_hash: ActionHash) -> ExternResult<Request>
```

Retrieves the latest request entry data.

**Parameters:**

- `original_action_hash`: The original action hash of the request

**Returns:**

- `Request`: The latest request data
- `Error`: If request is not found or cannot be deserialized

### Update Request

```rust
pub fn update_request(input: UpdateRequestInput) -> ExternResult<Record>
```

Updates an existing request with new data.

**Parameters:**

- `input`: An `UpdateRequestInput` struct containing:
  - `original_action_hash`: The original action hash
  - `previous_action_hash`: The most recent action hash
  - `updated_request`: The updated request data

**Returns:**

- `Record`: The updated request record
- `Error`: If update fails

**Access Control:**

- Only the original author or an administrator can update a request

### Delete Request

```rust
pub fn delete_request(original_action_hash: ActionHash) -> ExternResult<Record>
```

Deletes a request and all associated links.

**Parameters:**

- `original_action_hash`: The action hash of the request to delete

**Returns:**

- `Record`: The deleted request record
- `Error`: If deletion fails

**Access Control:**

- Only the original author or an administrator can delete a request

### Get All Requests

```rust
pub fn get_all_requests(_: ()) -> ExternResult<Vec<Record>>
```

Retrieves all requests in the system.

**Parameters:**

- None (empty tuple)

**Returns:**

- `Vec<Record>`: Array of all request records
- `Error`: If retrieval fails

### Get User Requests

```rust
pub fn get_user_requests(user_hash: ActionHash) -> ExternResult<Vec<Record>>
```

Retrieves all requests created by a specific user.

**Parameters:**

- `user_hash`: The action hash of the user profile

**Returns:**

- `Vec<Record>`: Array of request records created by the user
- `Error`: If retrieval fails

### Get Organization Requests

```rust
pub fn get_organization_requests(organization_hash: ActionHash) -> ExternResult<Vec<Record>>
```

Retrieves all requests associated with a specific organization.

**Parameters:**

- `organization_hash`: The action hash of the organization

**Returns:**

- `Vec<Record>`: Array of request records associated with the organization
- `Error`: If retrieval fails

### Get Request Creator

```rust
pub fn get_request_creator(request_hash: ActionHash) -> ExternResult<Option<ActionHash>>
```

Retrieves the creator of a request.

**Parameters:**

- `request_hash`: The action hash of the request

**Returns:**

- `Option<ActionHash>`: The action hash of the creator user profile, if found
- `Error`: If retrieval fails

### Get Request Organization

```rust
pub fn get_request_organization(request_hash: ActionHash) -> ExternResult<Option<ActionHash>>
```

Retrieves the organization associated with a request, if any.

**Parameters:**

- `request_hash`: The action hash of the request

**Returns:**

- `Option<ActionHash>`: The action hash of the associated organization, if any
- `Error`: If retrieval fails

## Validation Rules

### Request Validation

- Title cannot be empty
- Description cannot be empty and must be 500 characters or less
- At least one requirement must be specified
- Contact preference must be specified
- Time preference must be specified
- Exchange preference must be specified
- Interaction type must be specified
- If time estimate is provided, it must be greater than 0
- Links array must be present (can be empty)

## Client Integration

The UI integrates with the Requests zome through service and store layers:

### Requests Service

The `RequestsService` provides direct methods for interacting with the Holochain backend:

```typescript
export type RequestsService = {
  createRequest: (request: RequestInDHT, organizationHash?: ActionHash) => Effect<never, RequestError, Record>;
  getLatestRequestRecord: (originalActionHash: ActionHash) => Effect<never, RequestError, Record | null>;
  getLatestRequest: (originalActionHash: ActionHash) => Effect<never, RequestError, RequestInDHT | null>;
  updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInDHT
  ) => Effect<never, RequestError, Record>;
  getAllRequestsRecords: () => Effect<never, RequestError, Record[]>;
  getUserRequestsRecords: (userHash: ActionHash) => Effect<never, RequestError, Record[]>;
  getOrganizationRequestsRecords: (organizationHash: ActionHash) => Effect<never, RequestError, Record[]>;
  deleteRequest: (requestHash: ActionHash) => Effect<never, RequestError, void>;
};
```

### Requests Store

The `RequestsStore` provides a reactive state layer with caching, error handling, and event integration:

```typescript
export type RequestsStore = {
  readonly requests: UIRequest[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCache<UIRequest>;
  getLatestRequest: (originalActionHash: ActionHash) => Effect<never, RequestStoreError, UIRequest | null>;
  getAllRequests: () => Effect<never, RequestStoreError, UIRequest[]>;
  getUserRequests: (userHash: ActionHash) => Effect<never, RequestStoreError, UIRequest[]>;
  getOrganizationRequests: (organizationHash: ActionHash) => Effect<never, RequestStoreError, UIRequest[]>;
  createRequest: (request: RequestInDHT, organizationHash?: ActionHash) => Effect<never, RequestStoreError, Record>;
  updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInDHT
  ) => Effect<never, RequestStoreError, Record>;
  deleteRequest: (requestHash: ActionHash) => Effect<never, RequestStoreError, void>;
  invalidateCache: () => void;
};
```

The store implementation uses:

- **Svelte 5 runes (`$state`)** for reactive state management
- **`EntityCache`** for caching fetched data to reduce backend calls
- **`storeEventBus`** for cross-store communication and state synchronization
- **`effect`** for robust error handling and composable asynchronous operations

## hREA Integration

Requests are designed to integrate with the hREA economic model as follows:

- Requests are mapped to hREA Intents
- Requirements (skills) are mapped to hREA ResourceSpecifications
- Request process states align with hREA economic process states

## Usage Examples

### Creating a Request

```typescript
// Using the requests store
const newRequest: RequestInDHT = {
  title: "Development assistance needed",
  description: "Looking for help with Holochain DNA implementation",
  requirements: ["Rust", "Holochain"],
  urgency: "High"
};

// For a personal request
const result = await pipe(
  requestsStore.createRequest(newRequest),
  E.runPromise
);

// For an organization request
const result = await pipe(
  requestsStore.createRequest(newRequest, organizationHash),
  E.runPromise
);
```

### Getting All Requests

```typescript
// Using the requests store
const allRequests = await pipe(
  requestsStore.getAllRequests(),
  E.runPromise
);
```

### Updating a Request

```typescript
// Using the requests store
const updatedRequest: RequestInDHT = {
  ...existingRequest,
  title: "Updated title",
  description: "Updated description"
};

const result = await pipe(
  requestsStore.updateRequest(
    existingRequest.original_action_hash,
    existingRequest.previous_action_hash,
    updatedRequest
  ),
  E.runPromise
);
```

### Deleting a Request

```typescript
// Using the requests store
await pipe(
  requestsStore.deleteRequest(requestHash),
  E.runPromise
);
```
