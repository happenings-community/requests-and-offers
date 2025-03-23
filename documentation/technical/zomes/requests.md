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
  /// A detailed description of the request
  pub description: String,
  /// The requirements associated with the request (formerly skills)
  pub requirements: Vec<String>,
  /// The urgency or timeframe for the request
  pub urgency: Option<String>,
}
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
- Description cannot be empty
- At least one requirement must be specified

## Client Integration

The UI integrates with the Requests zome through service and store layers:

### Requests Service

The `RequestsService` provides direct methods for interacting with the Holochain backend:

```typescript
export type RequestsService = {
  createRequest: (request: RequestInDHT, organizationHash?: ActionHash) => Promise<Record>;
  getLatestRequestRecord: (originalActionHash: ActionHash) => Promise<Record | null>;
  getLatestRequest: (originalActionHash: ActionHash) => Promise<RequestInDHT | null>;
  updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInDHT
  ) => Promise<Record>;
  getAllRequestsRecords: () => Promise<Record[]>;
  getUserRequestsRecords: (userHash: ActionHash) => Promise<Record[]>;
  getOrganizationRequestsRecords: (organizationHash: ActionHash) => Promise<Record[]>;
  deleteRequest: (requestHash: ActionHash) => Promise<void>;
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
  getLatestRequest: (originalActionHash: ActionHash) => Promise<UIRequest | null>;
  getAllRequests: () => Promise<UIRequest[]>;
  getUserRequests: (userHash: ActionHash) => Promise<UIRequest[]>;
  getOrganizationRequests: (organizationHash: ActionHash) => Promise<UIRequest[]>;
  createRequest: (request: RequestInDHT, organizationHash?: ActionHash) => Promise<Record>;
  updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInDHT
  ) => Promise<Record>;
  deleteRequest: (requestHash: ActionHash) => Promise<void>;
  invalidateCache: () => void;
};
```

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
await requestsStore.createRequest(newRequest);

// For an organization request
await requestsStore.createRequest(newRequest, organizationHash);
```

### Getting All Requests

```typescript
// Using the requests store
const allRequests = await requestsStore.getAllRequests();
```

### Updating a Request

```typescript
// Using the requests store
const updatedRequest: RequestInDHT = {
  ...existingRequest,
  title: "Updated title",
  description: "Updated description"
};

await requestsStore.updateRequest(
  existingRequest.original_action_hash,
  existingRequest.previous_action_hash,
  updatedRequest
);
```

### Deleting a Request

```typescript
// Using the requests store
await requestsStore.deleteRequest(requestHash);
``` 