# Frontend Schema Validation API

Effect Schema validation system for type-safe data validation across all layers.

## Schema Architecture

Strategic validation boundaries using Effect Schema for input validation, data transformation, and type safety.

### Base Schema Patterns

```typescript
import { Schema } from "@effect/schema";

// Entity schemas
export const EntityStatusSchema = Schema.Union(
  Schema.Literal("pending"),
  Schema.Literal("approved"),
  Schema.Literal("rejected"),
);

export const BaseEntitySchema = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  status: EntityStatusSchema,
});

// Input schemas with validation
export const CreateEntityInputSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  description: Schema.String.pipe(Schema.minLength(1)),
});

// UI entity schemas (includes UI-specific fields)
export const UIEntitySchema = BaseEntitySchema.extend(
  Schema.Struct({
    hash: Schema.String, // ActionHash
    createdAt: Schema.Date,
  }),
);
```

## Domain Schemas

### Service Type Schemas

**File**: `ui/src/lib/schemas/service-type.schemas.ts`

Complete schema definitions for service type validation and transformation.

### Request Schemas

**File**: `ui/src/lib/schemas/request.schemas.ts`

Request-specific schemas with proper validation boundaries.

### User Schemas

**File**: `ui/src/lib/schemas/users.schemas.ts`

User profile schemas, plus the form-collection split that separates the DHT `name` field into given and family name inputs. `UserInDHT` is unchanged — `name` remains a single string — so there is no DNA bump and no data migration. The split lives only at the form boundary.

```typescript
// Form-collection shape: name split into two required fields.
// Mononymous users enter "." in family_name as an explicit declaration.
export const UserFormInputSchema = S.Struct({
  given_name: S.String.pipe(S.minLength(1), S.maxLength(100)),
  family_name: S.String.pipe(S.minLength(1), S.maxLength(100)),
  nickname: S.String.pipe(S.minLength(1), S.maxLength(50)),
  // ...remaining fields identical to UserInDHTSchema
});

/** Form → DHT: joins the two fields with a single space. Mononyms become "Sting ." */
export const formInputToDHT = (input: UserFormInput): UserInDHT => /* ... */;

/** DHT → form, for edit-mode pre-fill: first-space split, so compound family
 *  names ("del Carmen Rodriguez") are preserved. Mononyms get an empty
 *  family_name rather than an inherited dot. */
export const dhtToFormInput = (user: UserInDHT): UserFormInput => /* ... */;

/** Display helper: strips the " ." sentinel from a stored name.
 *  Embedded dots ("Dr. Smith", "J. R. R. Tolkien") are preserved. */
export const formatUserName = (name: string | null | undefined): string => /* ... */;
```

The trailing dot in a stored mononym (`"Sting ."`) is a vetting marker only; `formatUserName` strips it at every display site so it never reaches the UI. The action hash on a user record remains the canonical identity reference — names are display labels.

### Common Schemas

**File**: `ui/src/lib/schemas/common.schemas.ts`

```typescript
// Shared schemas used across domains
export const TimePreferenceSchema = Schema.Union(
  Schema.Literal("asap"),
  Schema.Literal("flexible"),
  Schema.Literal("specific"),
);

export const InteractionTypeSchema = Schema.Union(
  Schema.Literal("in-person"),
  Schema.Literal("remote"),
  Schema.Literal("hybrid"),
);
```

## Branded Hash Types

**File**: `ui/src/lib/schemas/holochain.schemas.ts`

Compile-time distinct types that prevent accidental swapping of original and previous action hashes:

```typescript
// Branded action hash types — zero runtime cost
export type OriginalActionHash = ActionHash & { readonly __brand: 'OriginalActionHash' };
export type PreviousActionHash = ActionHash & { readonly __brand: 'PreviousActionHash' };

/** Cast an ActionHash as an OriginalActionHash (zero-cost, compile-time only) */
export const asOriginalActionHash = (hash: ActionHash): OriginalActionHash =>
  hash as OriginalActionHash;

/** Cast an ActionHash as a PreviousActionHash (zero-cost, compile-time only) */
export const asPreviousActionHash = (hash: ActionHash): PreviousActionHash =>
  hash as PreviousActionHash;
```

These types correspond to Rust newtypes `OriginalActionHash` and `PreviousActionHash` in `dnas/requests_and_offers/utils/src/types.rs`. The `#[serde(transparent)]` attribute on the Rust side ensures wire format compatibility — no migration needed.

See [Action Hash Type Safety](../../action-hash-type-safety.md) for the full specification.

## Validation Integration

### Service Layer Validation

Schemas integrate with services for input/output validation and type safety.

### Store Layer Validation

Strategic validation at store boundaries for data integrity.

This schema system provides comprehensive type safety and validation across the application.
