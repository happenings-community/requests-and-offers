# Active/Archived Paths - Critical Implementation Details

## Architecture Changes

### Backend (Rust) Path Structure
```
offers.active     → Active offers only (LinkTypes::ActiveOffers)
offers.archived   → Archived offers only (LinkTypes::ArchivedOffers)
requests.active   → Active requests only (LinkTypes::ActiveRequests)
requests.archived → Archived requests only (LinkTypes::ArchivedRequests)
```

### Frontend Method Renaming Pattern
```typescript
// OLD → NEW
getAllOffers()        → getActiveOffers()
getAllRequests()      → getActiveRequests()
getAllArchivedOffers  → getArchivedOffers()  (also removed "All" prefix)
getAllArchivedRequests → getArchivedRequests()
hasOffers             → hasActiveOffers
hasRequests           → hasActiveRequests
```

## Critical Code Locations

### Backend Create Functions
**File:** `dnas/requests_and_offers/zomes/coordinator/offers/src/offer.rs`
**Lines:** 52-60
```rust
let path = Path::from("offers.active");
let path_hash = path.path_entry_hash()?;
create_link(path_hash, offer_hash, LinkTypes::ActiveOffers, ());
```

### Backend Query Functions
**File:** `dnas/requests_and_offers/zomes/coordinator/offers/src/offer.rs`
**Lines:** 161-186
```rust
pub fn get_active_offers(_: ()) -> ExternResult<Vec<Record>> {
  let path = Path::from("offers.active");
  let link_type_filter = LinkTypes::ActiveOffers.try_into_filter()?;
  let links = get_links(LinkQuery::new(path_hash, link_type_filter), GetStrategy::Network)?;
}
```

### Frontend Service Layer
**Files:**
- `ui/src/lib/services/zomes/offers.service.ts`
- `ui/src/lib/services/zomes/requests.service.ts`

**Methods Added:**
```typescript
getActiveOffersRecords: () => wrapZomeCall('offers', 'get_active_offers', null)
getArchivedOffersRecords: () => wrapZomeCall('offers', 'get_archived_offers', null)
getUserActiveOffersRecords: (hash) => wrapZomeCall('offers', 'get_user_active_offers', hash)
getUserArchivedOffersRecords: (hash) => wrapZomeCall('offers', 'get_user_archived_offers', hash)
```

### Frontend Store Layer
**Files:**
- `ui/src/lib/stores/offers.store.svelte.ts`
- `ui/src/lib/stores/requests.store.svelte.ts`

**Key Implementation:**
```typescript
const getActiveOffers = (): E.Effect<UIOffer[], OfferError> =>
  offerEntityFetcher(
    () => pipe(
      offersService.getActiveOffersRecords(),
      E.map((records) => syncCacheToState(records, 'activeOffers'))
    )
  );
```

## Current Issue Debugging

### Symptom
New offers/requests appear in MyListings but NOT in main offers/requests pages

### Data Flow Analysis

**MyListings (WORKS):**
```
MyListings.svelte
  → useOffersManagement.getUserActiveOffers(userHash)
    → offersStore.getUserActiveOffers(userHash)
      → offersService.getUserActiveOffersRecords(userHash)
        → Backend: get_user_active_offers(user_hash)
          → Queries: LinkTypes::UserOffers (user profile links)
          → Filters by status == ListingStatus::Active
```

**Main Offers Page (DOESN'T WORK):**
```
offers/+page.svelte
  → useOffersManagement.getActiveOffers()
    → offersStore.getActiveOffers()
      → offersService.getActiveOffersRecords()
        → Backend: get_active_offers(())
          → Queries: LinkTypes::ActiveOffers ("offers.active" path)
          → Uses: GetStrategy::Network
```

### Root Cause
Holochain conductor DHT cache has old indexing. New path structure not recognized.

### Fix Applied
```bash
rm -rf ui/.holochain  # Clear conductor cache
bun start             # Restart with fresh cache
```

## Phase 6 Test Requirements

### Tryorama Test Updates

**Files to Update:**
- `tests/offers/test-offers.ts`
- `tests/requests/test-requests.ts`

**Required Test Changes:**
1. Verify create uses `"*.active"` path
2. Verify archive moves link to `"*.archived"` path
3. Verify `get_active_*()` returns only active items
4. Verify `get_archived_*()` returns only archived items
5. Add link type assertions for new types

### Example Test Pattern
```typescript
// Test that create uses active path
const createResult = await alice.callZome({
  zome_name: "offers",
  fn_name: "create_offer",
  payload: offerInput
});

// Verify link in offers.active path
const activeOffers = await alice.callZome({
  zome_name: "offers",
  fn_name: "get_active_offers",
  payload: null
});
assert.equal(activeOffers.length, 1);

// Verify NOT in archived path
const archivedOffers = await alice.callZome({
  zome_name: "offers",
  fn_name: "get_archived_offers",
  payload: null
});
assert.equal(archivedOffers.length, 0);
```

## Validation Checklist

### Backend Verification
- [x] Link types compile (integrity zomes)
- [x] Zomes build successfully
- [x] Create uses `"*.active"` paths
- [x] Archive moves between paths
- [x] Query functions use correct paths

### Frontend Verification
- [x] TypeScript check passes
- [x] All occurrences renamed
- [x] Service methods updated
- [x] Store methods updated

### Integration Verification (After Cache Fix)
- [ ] New offers appear in main list
- [ ] Archive removes from active
- [ ] MyListings shows correct items
- [ ] No console errors
- [ ] Performance improved

## Common Pitfalls

1. **Conductor Cache:** Always clear after backend path changes
2. **Method Naming:** Frontend and backend must match (`get_active_offers`)
3. **Link Type Matching:** Create and query must use same link type
4. **GetStrategy:** Use `Network` for DHT-wide queries, `Local` for agent-local
