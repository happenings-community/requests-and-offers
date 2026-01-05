# Active/Archived Paths Implementation Plan

## Overview
Replace single-path approach (`"offers"`, `"requests"`) with separate status-specific paths (`"offers.active"`, `"offers.archived"`, `"requests.active"`, `"requests.archived"`) for more efficient DHT queries and better scalability.

## Implementation Progress

### ✅ Completed Phases

#### Phase 0: Add New Link Types to Integrity Zomes
**Status:** COMPLETED

Added new link types to handle active/archived path separation:
- `ActiveOffers` - for `"offers.active"` path
- `ArchivedOffers` - for `"offers.archived"` path
- `ActiveRequests` - for `"requests.active"` path
- `ArchivedRequests` - for `"requests.archived"` path

**Files Modified:**
- `/dnas/requests_and_offers/zomes/integrity/offers/src/lib.rs`
- `/dnas/requests_and_offers/zomes/integrity/requests/src/lib.rs`

#### Phase 1: Update Create Functions
**Status:** COMPLETED

Updated create functions to use `"*.active"` paths with new link types:
- `create_offer()` → creates link in `"offers.active"` path with `LinkTypes::ActiveOffers`
- `create_request()` → creates link in `"requests.active"` path with `LinkTypes::ActiveRequests`

**Files Modified:**
- `/dnas/requests_and_offers/zomes/coordinator/offers/src/offer.rs` (lines 52-60)
- `/dnas/requests_and_offers/zomes/coordinator/requests/src/request.rs` (lines 52-60)

**Code Example:**
```rust
// Create link from offers.active path
let path = Path::from("offers.active");
let path_hash = path.path_entry_hash()?;
create_link(
  path_hash.clone(),
  offer_hash.clone(),
  LinkTypes::ActiveOffers,
  (),
)?;
```

#### Phase 2: Update Archive Functions
**Status:** COMPLETED

Updated archive functions to move links between paths:
- `archive_offer()` → deletes from `"offers.active"`, creates in `"offers.archived"`
- `archive_request()` → deletes from `"requests.active"`, creates in `"requests.archived"`

**Files Modified:**
- `/dnas/requests_and_offers/zomes/coordinator/offers/src/offer.rs` (lines 577-613)
- `/dnas/requests_and_offers/zomes/coordinator/requests/src/request.rs` (lines 581-617)

**Operations:**
1. Delete link from `"*.active"` path
2. Create link in `"*.archived"` path
3. Update entry status (for backward compatibility)
4. Create update tracking link

#### Phase 3: Update Query Functions
**Status:** COMPLETED

Updated and added query functions:
- `get_all_offers()` → renamed to `get_active_offers()`, queries `"offers.active"` path
- `get_all_requests()` → renamed to `get_active_requests()`, queries `"requests.active"` path
- Added `get_archived_offers()`, queries `"offers.archived"` path
- Added `get_archived_requests()`, queries `"requests.archived"` path
- Added `get_user_active_offers()`, `get_user_archived_offers()`
- Added `get_user_active_requests()`, `get_user_archived_requests()`

**Files Modified:**
- `/dnas/requests_and_offers/zomes/coordinator/offers/src/offer.rs`
- `/dnas/requests_and_offers/zomes/coordinator/requests/src/request.rs`

**New Backend Functions:**
```rust
#[hdk_extern]
pub fn get_active_offers(_: ()) -> ExternResult<Vec<Record>> {
  let path = Path::from("offers.active");
  let path_hash = path.path_entry_hash()?;
  let link_type_filter = LinkTypes::ActiveOffers.try_into_filter()?;
  let links = get_links(
    LinkQuery::new(path_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;
  // ... fetch records
}

#[hdk_extern]
pub fn get_archived_offers(_: ()) -> ExternResult<Vec<Record>> {
  let path = Path::from("offers.archived");
  // ... similar pattern
}
```

#### Phase 4: Frontend Service Layer
**Status:** COMPLETED

**Files Modified:**
- `/ui/src/lib/services/zomes/offers.service.ts`
- `/ui/src/lib/services/zomes/requests.service.ts`

**Changes:**
- Added `getActiveOffersRecords()` and `getActiveRequestsRecords()` methods
- Added `getArchivedOffersRecords()` and `getArchivedRequestsRecords()` methods
- Added `getUserActiveOffersRecords()`, `getUserArchivedOffersRecords()`
- Added `getUserActiveRequestsRecords()`, `getUserArchivedRequestsRecords()`

**Service Interface:**
```typescript
interface OffersService {
  getActiveOffersRecords: () => E.Effect<Record[], OfferError>;
  getArchivedOffersRecords: () => E.Effect<Record[], OfferError>;
  getUserActiveOffersRecords: (userHash: ActionHash) => E.Effect<Record[], OfferError>;
  getUserArchivedOffersRecords: (userHash: ActionHash) => E.Effect<Record[], OfferError>;
  // ... other methods
}
```

#### Phase 5: Frontend Store Layer
**Status:** COMPLETED

**Files Modified:**
- `/ui/src/lib/stores/offers.store.svelte.ts`
- `/ui/src/lib/stores/requests.store.svelte.ts`
- `/ui/src/lib/composables/domain/offers/useOffersManagement.svelte.ts`
- `/ui/src/lib/composables/domain/requests/useRequestsManagement.svelte.ts`
- `/ui/src/lib/components/hrea/test-page/ProposalManager.svelte`
- `/ui/src/routes/(public)/service-types/[id]/+page.svelte`
- `/ui/src/routes/admin/service-types/[id]/+page.svelte`
- Test files: `services.mock.ts`, `*.store.test.ts`, `*.test.ts`

**Key Renaming:**
- `getAllOffers()` → `getActiveOffers()`
- `getAllRequests()` → `getActiveRequests()`
- Added `getArchivedOffers()` and `getArchivedRequests()`
- `hasOffers` → `hasActiveOffers`
- `hasRequests` → `hasActiveRequests`

**Store Interface:**
```typescript
export type OffersStore = {
  getActiveOffers: () => E.Effect<UIOffer[], OfferError>;
  getArchivedOffers: () => E.Effect<UIOffer[], OfferError>;
  hasActiveOffers: () => E.Effect<boolean, OfferError>;
  // ... other methods
}
```

**TypeScript Check:** ✅ PASSED (0 errors, 2 pre-existing accessibility warnings)

### 🔄 Pending Phases

#### Phase 6: Update Tryorama Tests
**Status:** PENDING

**Tasks:**
1. Update test file locations to `/tests/` directory
2. Update create tests to verify items are created with active paths
3. Update archive tests to verify path movement from active to archived
4. Update query tests to verify correct path queries
5. Add new tests for archived item retrieval
6. Run `bun test` to verify all tests pass

**Test Changes Needed:**
- Update assertions that check path link types
- Add assertions for new link types (`ActiveOffers`, `ArchivedOffers`, etc.)
- Verify archive operation moves link between paths correctly
- Test that `get_active_*()` returns only active items
- Test that new `get_archived_*()` functions return archived items

**Test Files to Update:**
- `/tests/offers/test-offers.ts`
- `/tests/requests/test-requests.ts`

#### Phase 7: Testing and Validation
**Status:** PENDING

**Validation Checklist:**

**Backend (Rust):**
- [x] Link types compile successfully (integrity zomes)
- [x] Zomes build without errors
- [x] Create functions use `"*.active"` paths and new link types
- [x] Archive functions move links from active to archived paths
- [x] Query functions use correct paths and link types

**Tests (Tryorama):**
- [ ] All existing tests pass after link type updates
- [ ] Create tests verify active path usage
- [ ] Archive tests verify path movement
- [ ] Query tests return correct items
- [ ] New archived query tests work

**Frontend (TypeScript):**
- [x] TypeScript check passes (`bun run check`)
- [x] New archived service methods exist
- [x] Store methods call correct backend functions
- [x] Manual filtering logic removed from stores

**Integration:**
- [ ] New offers appear in active list only
- [ ] New requests appear in active list only
- [ ] Archive removes from active, appears in archived
- [ ] Main `/offers` page shows only active offers
- [ ] Main `/requests` page shows only active requests
- [ ] MyListings "Active" tab shows correct items
- [ ] MyListings "Archived" tab shows correct items
- [ ] No console errors in browser
- [ ] Network queries are faster (fetch fewer items)

## Current Issue: Offers/Requests Not Appearing in Main List

### Problem Description
When creating a new offer or request:
- ✅ **APPEARS** in MyListings page (`/my-listings`)
- ❌ **DOES NOT APPEAR** in main offers page (`/offers`) or requests page (`/requests`)

### Root Cause Analysis

**Data Flow Difference:**

1. **MyListings** uses:
   ```typescript
   store.getUserActiveOffers(userHash)
   ```
   - Backend function: `get_user_active_offers(user_hash)`
   - Queries: User profile links (`LinkTypes::UserOffers`)
   - Then filters by status `== ListingStatus::Active`

2. **Main offers page** uses:
   ```typescript
   store.getActiveOffers()
   ```
   - Backend function: `get_active_offers(())`
   - Queries: `"offers.active"` path (`LinkTypes::ActiveOffers`)
   - Uses `GetStrategy::Network`

### Diagnosis

The issue is a **Holochain conductor DHT cache problem**. After implementing the new path structure:
- Old offers/requests are in `"offers"` path
- New offers/requests should be in `"offers.active"` path
- The conductor's DHT cache needs to be rebuilt to recognize the new path indexing

### Solution

**Step 1:** Stop the development server (if running)

**Step 2:** Clear the Holochain conductor cache:
```bash
rm -rf /home/soushi888/Projets/Holochain/requests-and-offers/ui/.holochain
```

**Step 3:** Restart the development server:
```bash
bun start
```

**Step 4:** Test the fix:
1. Create a new offer or request
2. Verify it appears in both:
   - MyListings page (`/my-listings`)
   - Main offers/requests page (`/offers` or `/requests`)

### Verification Commands

After clearing cache and restarting, verify:

```bash
# Check zomes are built
bun build:zomes

# Run TypeScript check
cd ui && bun run check

# Start development server
bun start
```

### Backend Code Verification

**Create Offer** (`offer.rs:52-60`):
```rust
// Create link from offers.active path
let path = Path::from("offers.active");
let path_hash = path.path_entry_hash()?;
create_link(
  path_hash.clone(),
  offer_hash.clone(),
  LinkTypes::ActiveOffers,
  (),
)?;
```

**Query Active Offers** (`offer.rs:161-186`):
```rust
#[hdk_extern]
pub fn get_active_offers(_: ()) -> ExternResult<Vec<Record>> {
  let path = Path::from("offers.active");
  let path_hash = path.path_entry_hash()?;
  let link_type_filter = LinkTypes::ActiveOffers.try_into_filter()?;
  let links = get_links(
    LinkQuery::new(path_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;
  // ... fetch records
}
```

### Next Steps After Fix

1. **Verify the fix works** - create new offer/request and check both pages
2. **Continue with Phase 6** - Update Tryorama tests
3. **Complete Phase 7** - Full testing and validation

## Critical Files Reference

### Backend (Rust)
- `/dnas/requests_and_offers/zomes/integrity/offers/src/lib.rs` - Link types enum
- `/dnas/requests_and_offers/zomes/integrity/requests/src/lib.rs` - Link types enum
- `/dnas/requests_and_offers/zomes/coordinator/offers/src/offer.rs` - All offer operations
- `/dnas/requests_and_offers/zomes/coordinator/requests/src/request.rs` - All request operations

### Frontend (TypeScript)
- `/ui/src/lib/services/zomes/offers.service.ts` - Offers service layer
- `/ui/src/lib/services/zomes/requests.service.ts` - Requests service layer
- `/ui/src/lib/stores/offers.store.svelte.ts` - Offers state management
- `/ui/src/lib/stores/requests.store.svelte.ts` - Requests state management
- `/ui/src/lib/composables/domain/offers/useOffersManagement.svelte.ts` - Offers management logic
- `/ui/src/lib/composables/domain/requests/useRequestsManagement.svelte.ts` - Requests management logic

### Tests
- `/ui/tests/mocks/services.mock.ts` - Mock service implementations
- `/ui/tests/unit/stores/offers.store.test.ts` - Offers store unit tests
- `/ui/tests/unit/stores/requests.store.test.ts` - Requests store unit tests
- `/ui/tests/integration/offers-requests-interaction.test.ts` - Integration tests
- `/tests/offers/test-offers.ts` - Tryorama backend tests
- `/tests/requests/test-requests.ts` - Tryorama backend tests

## Migration Notes

**No existing data migration needed** - Project is still in development, so no legacy data to migrate. All new offers/requests will use the new path structure from the start.

## Rollback Plan

If issues arise:
1. Revert backend changes to single-path approach
2. Revert frontend service/store changes
3. Clear Holochain conductor cache
4. Restart development server

Estimated rollback time: 15 minutes

## Benefits Summary

1. **Performance**: Fewer DHT fetches (no need to get archived items when viewing active)
2. **Scalability**: Active queries remain fast as archived items accumulate
3. **Simplicity**: Frontend filtering reduced/eliminated
4. **Semantic**: Path structure reflects business logic
5. **Maintainability**: Clearer separation of concerns

---

**Last Updated:** 2025-01-05
**Session:** Active/Archived Paths Implementation
**Current Status:** Phase 5 Complete, Issue Identified, Fix Documented
