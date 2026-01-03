# Update Bug Fix - Creator, Service Types, and Mediums of Exchange Lost After Update

## Issue Summary
When updating a request or offer, the UI would lose all related data (creator, service types, mediums of exchange) until a page refresh. Additionally, the list view would show the original entry instead of the updated one.

## Root Cause Analysis

### Backend Bug: Links Not Updated for New Action Hash
**Files Affected:**
- `dnas/requests_and_offers/zomes/coordinator/requests/src/request.rs:313-324`
- `dnas/requests_and_offers/zomes/coordinator/offers/src/offer.rs:303-314`

**Problem:** After calling `update_entry()`, a new action hash is created for the updated entry. However, the link update functions (`update_service_type_links` and `update_medium_of_exchange_links`) were being called with the `original_action_hash` instead of the new `updated_request_hash`/`updated_offer_hash`.

This caused:
1. New entry had NO links (creator, service types, mediums of exchange)
2. Old entry still had all the links
3. Frontend queried the NEW entry but found no links

### Frontend Bug: Related Data Not Fetched After Update
**Files Affected:**
- `ui/src/lib/stores/requests.store.svelte.ts:433-463`
- `ui/src/lib/stores/offers.store.svelte.ts:407-435`

**Problem:** The `updateRequest`/`updateOffer` functions were using `createUIRequest`/`createUIOffer` which only created a basic entity without fetching related data (creator profile, service types, mediums of exchange). The `createEnhancedUIRequest`/`createEnhancedUIOffer` functions should have been used instead.

## Solution Applied

### Backend Fixes
Changed the `action_hash` parameter in link update calls from `original_action_hash` to `updated_request_hash`/`updated_offer_hash`:

```rust
// BEFORE (WRONG)
update_service_type_links(UpdateServiceTypeLinksInput {
    action_hash: input.original_action_hash.clone(),  // ❌
    entity: "request".to_string(),
    new_service_type_hashes: input.service_type_hashes,
})?;

// AFTER (CORRECT)
update_service_type_links(UpdateServiceTypeLinksInput {
    action_hash: updated_request_hash.clone(),  // ✅
    entity: "request".to_string(),
    new_service_type_hashes: input.service_type_hashes,
})?;
```

### Frontend Fixes
Changed from basic entity creation to enhanced entity creation that fetches all related data:

```typescript
// BEFORE (WRONG)
E.map((record) => {
  const baseEntity = createUIRequest(record, { authorPubKey });
  // Missing: creator, service types, mediums of exchange
  ...
})

// AFTER (CORRECT)
E.flatMap((record) =>
  pipe(
    createEnhancedUIRequest(record, requestsService),  // ✅ Fetches all related data
    E.map((updatedUIRequest) => {
      // Now includes: creator, service types, mediums of exchange
      ...
    })
  )
)
```

## Testing Results

### Backend Build
✅ `bun build:zomes` - Successful compilation (4.06s)
- 2 minor warnings about unused code (unrelated to fix)

### Frontend Type Check
✅ `bun run check` - 0 errors, 2 warnings (unrelated accessibility warnings)

## Files Modified
1. `dnas/requests_and_offers/zomes/coordinator/requests/src/request.rs` (Backend)
2. `dnas/requests_and_offers/zomes/coordinator/offers/src/offer.rs` (Backend)
3. `ui/src/lib/stores/requests.store.svelte.ts` (Frontend)
4. `ui/src/lib/stores/offers.store.svelte.ts` (Frontend)

## Expected Behavior After Fix
1. ✅ Updated requests/offers immediately show creator information
2. ✅ Service types are preserved and displayed after update
3. ✅ Mediums of exchange are preserved and displayed after update
4. ✅ List view shows the updated version immediately (no refresh needed)
5. ✅ Cache properly synchronized with updated entity

## Session Date
2026-01-03