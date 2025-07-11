# UI Types and Schemas Documentation

This document details the type system and schema validation approach used in the Requests and Offers application.

## Type Architecture

The application uses a layered type architecture that maps between different representations of data:

1. **DHT Types**: Raw data structures stored in Holochain DHT
2. **UI Types**: Enhanced types for frontend use with additional metadata
3. **Form Types**: Specialized types for user input forms
4. **API Types**: Types for external API communication

### Type Organization

```
/lib/types/
├── holochain.ts       # Holochain-specific type definitions
├── ui.ts              # UI-specific type definitions
├── common.ts          # Shared type definitions
└── domain/            # Domain-specific types
    ├── serviceTypes.ts # Service types domain types
    ├── requests.ts     # Requests domain types
    ├── offers.ts       # Offers domain types
    └── ...             # Other domain types
```

## Schema Validation

The application uses Effect Schema for robust validation at key boundaries:

```
/lib/schemas/
├── serviceTypes.schemas.ts   # Service types validation schemas
├── requests.schemas.ts        # Requests validation schemas
├── offers.schemas.ts          # Offers validation schemas
└── ...                        # Other domain schemas
```

### Schema Strategy

Validation is applied at three key boundaries:

1. **User Input**: Validate form data before submission
2. **Service Layer**: Validate data before sending to Holochain
3. **Store Processing**: Validate data before updating UI state

## Core Type Patterns

### Entity Base Types

All entities follow a consistent pattern with DHT and UI variants:

```typescript
// DHT Types (stored in Holochain)
export type ServiceTypeInDHT = {
    name: string;
    description: string;
    tags: string[];
    status: 'pending' | 'approved' | 'rejected';
    createdAt: number;
};

// UI Types (used in frontend)
export type UIServiceType = ServiceTypeInDHT & {
    id: string;  // Base64-encoded ActionHash
    actionHash: ActionHash;
    original_action_hash: ActionHash; // For update tracking
    createdAt: Date;  // Converted to JavaScript Date
    updatedAt?: Date; // Optional update timestamp
};
```

### Form Input Types

Specialized types for form handling:

```typescript
export type ServiceTypeFormInput = {
    name: string;
    description: string;
    tags: string[];
};
```

### Tagged Error Types

Domain-specific error hierarchies:

```typescript
export class ServiceTypeNotFoundError extends TaggedError<{
    readonly _tag: 'ServiceTypeNotFoundError';
    readonly hash: string;
}>() {
    get message() {
        return `Service type with hash ${this.hash} not found`;
    }
}
```

## Schema Examples

### Input Validation Schema

```typescript
export const ServiceTypeInputSchema = S.struct({
    name: pipe(
        S.string,
        S.minLength(3),
        S.maxLength(100)
    ),
    description: pipe(
        S.string,
        S.minLength(10),
        S.maxLength(1000)
    ),
    tags: pipe(
        S.array(S.string),
        S.maxLength(10)
    )
});
```

### Response Validation Schema

```typescript
export const ServiceTypeResponseSchema = S.struct({
    name: S.string,
    description: S.string,
    tags: S.array(S.string),
    status: S.enums(['pending', 'approved', 'rejected']),
    createdAt: S.number
});
```

## Type Transformations

The application includes utility functions for transforming between type representations:

```typescript
// Convert Holochain record to UI entity
const createUIServiceType = (record: HolochainRecord): UIServiceType => {
    const entry = decode((record.entry as any).Present.entry) as ServiceTypeInDHT;
    const actionHash = record.signed_action.hashed.hash;
    const timestamp = record.signed_action.hashed.content.timestamp;

    return {
        ...entry,
        id: encodeHashToBase64(actionHash),
        actionHash,
        original_action_hash: actionHash,
        createdAt: new Date(timestamp / 1000) // Convert microseconds to milliseconds
    };
};
```

## Branded Types

For enhanced type safety, the application uses branded types for certain identifiers:

```typescript
// Define a brand for ActionHash
export type ActionHashBrand = Brand.Brand<ActionHash, 'ActionHash'>;

// Create a branded type
export type ActionHashId = Brand.Branded<ActionHash, ActionHashBrand>;

// Usage
function getServiceType(hash: ActionHashId): E.Effect<UIServiceType, ServiceTypeError> {
    // Implementation using strongly-typed hash
}
```

## Best Practices

1. **Consistent Naming**: Follow established naming conventions
    - `*InDHT` for Holochain data types
    - `UI*` for frontend-enhanced types
    - `*FormInput` for form data types

2. **Explicit Transformations**: Always use explicit transformation functions
    - `createUI*` for DHT → UI conversions
    - `create*Input` for UI → form conversions

3. **Schema Validation**: Apply schemas at all key boundaries
    - User input validation
    - Service method parameter validation
    - Response data validation

4. **Error Types**: Use tagged errors with informative contexts
    - Define domain-specific error hierarchies
    - Include relevant context in error payloads

5. **Documentation**: Document complex types and transformations
    - Explain the purpose of each type
    - Document relationships between types

## Type Lifecycle

A typical data flow through the type system:

1. **User Input** → Form validation using `*FormInput` types and schemas
2. **Form Submission** → Transform to `*InDHT` type for Holochain
3. **Service Layer** → Validate using schemas before sending to Holochain
4. **Holochain Response** → Transform to `UI*` type for frontend use
5. **Store Update** → Store and distribute `UI*` entity through the application
6. **Component Rendering** → Components consume and display `UI*` entities

## Implementation Status

| Domain        | Type Implementation | Schema Implementation | Notes                           |
|---------------|---------------------|-----------------------|---------------------------------|
| ServiceTypes  | ✅ Complete          | ✅ Complete            | Full type safety with schemas   |
| Requests      | ✅ Complete          | ✅ Complete            | Full type safety with schemas   |
| Offers        | 🔄 In Progress      | 🔄 In Progress        | Converting to standard patterns |
| Users         | 📋 Planned          | 📋 Planned            | Needs standardization           |
| Organizations | 📋 Planned          | 📋 Planned            | Needs standardization           |
