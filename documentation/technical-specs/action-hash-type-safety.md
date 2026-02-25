# Action Hash Type Safety

Compile-time distinct types for `OriginalActionHash` and `PreviousActionHash` to prevent accidental hash swapping between original entity identifiers and update-chain head pointers.

## Problem

Holochain's CRUD model uses two different action hashes for updates:

- **Original action hash**: The hash of the initial `Create` action — serves as the immutable entity identity throughout its lifecycle.
- **Previous action hash**: The hash of the most recent action in the update chain — needed by `update()` to append to the chain correctly.

Both are `ActionHash` at the type level. Swapping them compiles but produces silent data corruption: updates target the wrong chain entry or create orphaned forks.

## Rust Newtypes

**File**: `dnas/requests_and_offers/utils/src/types.rs`

```rust
/// The ActionHash of the original Create action — immutable entity identifier.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(transparent)]
pub struct OriginalActionHash(pub ActionHash);

/// The ActionHash of the most recent action in the update chain.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(transparent)]
pub struct PreviousActionHash(pub ActionHash);
```

### Key properties

- **`#[serde(transparent)]`**: Wire format is identical to a plain `ActionHash`. No migration needed for existing data.
- **`From` trait implementations**: Both types implement `From<T> for ActionHash`, `From<T> for AnyDhtHash`, and `From<T> for AnyLinkableHash` for seamless HDK 0.6 interop.
- **Direct access**: Use `.0` to access the inner `ActionHash` when needed.
- **Wrapping**: Use `OriginalActionHash(hash)` or `PreviousActionHash(hash)` to wrap a plain `ActionHash`.
- **Conversion**: Use `.into()` when passing to HDK functions that expect `ActionHash`, `AnyDhtHash`, or `AnyLinkableHash`.

### Usage in update inputs

All update input structs use the distinct types:

```rust
pub struct UpdateServiceTypeInput {
    pub original_action_hash: OriginalActionHash,
    pub previous_action_hash: PreviousActionHash,
    pub updated_service_type: ServiceType,
}
```

## TypeScript Branded Types

**File**: `ui/src/lib/schemas/holochain.schemas.ts`

```typescript
// Branded action hash types for compile-time type safety.
// serde(transparent) on the Rust side means wire format is identical to ActionHash.
export type OriginalActionHash = ActionHash & { readonly __brand: 'OriginalActionHash' };
export type PreviousActionHash = ActionHash & { readonly __brand: 'PreviousActionHash' };

/** Cast an ActionHash as an OriginalActionHash (zero-cost, compile-time only) */
export const asOriginalActionHash = (hash: ActionHash): OriginalActionHash =>
  hash as OriginalActionHash;

/** Cast an ActionHash as a PreviousActionHash (zero-cost, compile-time only) */
export const asPreviousActionHash = (hash: ActionHash): PreviousActionHash =>
  hash as PreviousActionHash;
```

### Key properties

- **Intersection types**: `ActionHash & { readonly __brand: ... }` — the brand field exists only at compile time, not at runtime.
- **Zero-cost**: No runtime overhead. The helper functions are simple type casts (`as`).
- **Narrowing helpers**: `asOriginalActionHash()` and `asPreviousActionHash()` provide readable call sites instead of inline `as` casts.

## Entity Identity Model

`original_action_hash` is the canonical identity for all non-exchange entity types in the UI layer.

### UI entity types (`ui/src/lib/types/ui.ts`)

Every core UI type declares both hash fields as required:

```typescript
export type UIUser = UserInDHT & {
  original_action_hash: ActionHash;
  previous_action_hash: ActionHash;
  // ... other fields
};

export type UIServiceType = ServiceTypeInDHT & {
  original_action_hash: ActionHash;
  previous_action_hash: ActionHash;
  // ... other fields
};
```

The same pattern applies to `UIStatus`, `UIOrganization`, `UIRequest`, and `UIOffer`.

### CacheableEntity (`ui/src/lib/types/store-helpers.ts`)

The cache interface keeps `original_action_hash` optional for hREA compatibility (hREA entities use a different identity scheme):

```typescript
export interface CacheableEntity {
  readonly original_action_hash?: ActionHash;
  readonly [key: string]: unknown;
}
```

### Exchange types

Exchange types (`UIExchangeResponse`, `UIExchangeAgreement`, `UIExchangeReview`) use `actionHash` instead of `original_action_hash` because exchanges are not updated via the standard CRUD chain — they follow a proposal/agreement lifecycle.

## Key Files Reference

| File | Role |
|------|------|
| `dnas/requests_and_offers/utils/src/types.rs` | Rust newtype definitions and `From` implementations |
| `ui/src/lib/schemas/holochain.schemas.ts` | TypeScript branded type definitions and cast helpers |
| `ui/src/lib/types/ui.ts` | UI entity types with required hash fields |
| `ui/src/lib/types/store-helpers.ts` | `CacheableEntity` interface (optional hash for hREA compat) |
| `ui/src/lib/utils/store-helpers/cache-helpers.ts` | Cache lookup using `original_action_hash` |
