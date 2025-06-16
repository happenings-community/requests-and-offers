# Service Type Tag Search & Indexing Enhancement

This task list tracks the work required to complete a robust tag-based discovery system for **Service Types**. The goal is to allow users to efficiently search, filter, and explore service types via their associated tags while maintaining performant, well-indexed data structures.

## Completed Tasks

- [x] Path-anchor based tag indexing implemented (`service_types.tags.{tag}`)
- [x] `get_all_service_type_tags()` backend function available
- [x] Tag cleanup logic on `ServiceType` deletion/update
- [x] Backend: Implement `get_service_types_by_tag(tag: String)`
- [x] Backend: Implement `get_service_types_by_tags(tags: Vec<String>)` (AND logic)
- [x] Backend: Implement `search_service_types_by_tag_prefix(prefix: String)` for autocomplete
- [x] Backend: Implement `get_tag_statistics()` (usage counts)
- [x] Service Layer: Expose new tag functions in `serviceTypes.service.ts`
- [x] Store: Add tag-related state & methods (`allTags`, `selectedTags`, `searchByTags`, etc.)
- [x] Unit Tests: Rust – comprehensive Tryorama tests covering all tag functionality (`tag-functionality.test.ts`)

## In Progress Tasks

- [x] UI Component: `TagAutocomplete.svelte` for real-time suggestions ✅
- [x] UI Component: Extend `ServiceTypeSelector.svelte` with tag filtering ✅
- [x] UI Component: `TagCloud.svelte` – visual tag cloud weighted by popularity ✅
- [x] UI Page: Enhance `/service-types` with multi-tag search panel ✅
- [x] UI Enhancement: Clickable tags in `ServiceTypeCard.svelte` with smart routing ✅
- [x] UI Page: Admin service types page with multi-tag search panel ✅
- [x] **Tag-Based Request/Offer Discovery (Phase 3.5):**
  - [x] Backend: Add `get_requests_by_tag(tag: String)` to `requests_coordinator` ✅
  - [x] Backend: Add `get_offers_by_tag(tag: String)` to `offers_coordinator` ✅
  - [x] Service Layer: Expose `getRequestsByTag` in `requests.service.ts` ✅
  - [x] Service Layer: Expose `getOffersByTag` in `offers.service.ts` ✅
  - [x] Store: Add tag-based methods to `requests.store.svelte.ts` ✅
  - [x] Store: Add tag-based methods to `offers.store.svelte.ts` ✅
  - [x] UI Component: Create `TagDetailsView.svelte` - comprehensive tag discovery component ✅
  - [x] UI Route: Create `/tags/[tag]/+page.svelte` - tag details page ✅
  - [x] UI Enhancement: Make tags clickable in `RequestCard`/`RequestDetails` components ✅
  - [x] UI Enhancement: Make tags clickable in `OfferCard`/`OfferDetails` components ✅
- [x] Unit Tests: TS – cover new service & store methods
- [x] Integration Tests: Ensure tag-based filtering works end-to-end
- [x] Unit Tests: TS – cover tag to requests/offers linking ✅
- [x] Integration Tests: TS – cover tag to requests/offers linking ✅

## Future Tasks / Bonus

- [x] UI Component: `TagCloud.svelte` – visual tag cloud weighted by popularity ✅
- [ ] Smart Suggestions: Related tag recommendations based on current selection
- [ ] Performance Optimisation: Pagination & caching for very large result sets
- [ ] Analytics Dashboard: Visualise tag statistics for admins

## Implementation Plan

### Phase 1 – Backend Core Functions (High Priority)
1. Add missing extern functions to `dnas/requests_and_offers/zomes/coordinator/service_types/src/service_type.rs`:
   - `get_service_types_by_tag` – fetch approved service types linked to a specific tag path.
   - `get_service_types_by_tags` – intersection of results from multiple tags.
   - `search_service_types_by_tag_prefix` – iterate over `all_tags` anchor; return matching service types.
   - `get_tag_statistics` – count service types per tag (approved only).
2. Unit tests (Tryorama) for each new function.
3. Update DNA manifest capabilities if required.

### Phase 2 – Frontend Service & Store (High Priority)
1. Extend `ServiceTypesService` interface & live implementation with:
   - `getServiceTypesByTag`, `getServiceTypesByTags`, `getAllServiceTypeTags`, `searchServiceTypesByTagPrefix`, `getTagStatistics`.
2. Update `createServiceTypesStore`:
   - Reactive state: `allTags`, `selectedTags`, `searchResults`, `tagStatistics`.
   - Methods: `searchByTags`, `getTagSuggestions` (prefix search), cache integration.
3. Unit tests (Vitest) for new service & store logic.

### Phase 3 – UI Enhancements (Medium Priority)
1. **TagAutocomplete.svelte** – Debounced input, shows suggestions from `searchServiceTypesByTagPrefix`.
2. **ServiceTypeSelector.svelte** – Add tag filter section with multi-select chips; integrate AND/OR logic toggle.
3. Update main Service Types pages (public & admin) with advanced search panel (text + tags) and display search results.
4. Integration tests to validate user flows.

### Phase 3.5 – Tag-Based Request/Offer Discovery
1. **Backend**: Add `get_requests_by_tag(tag: String)` to `requests_coordinator`. This function will call `service_types/get_service_types_by_tag` and then find all unique requests linked to the resulting service types.
2. **Backend**: Add `get_offers_by_tag(tag: String)` to `offers_coordinator`, following the same pattern as above.
3. **Service Layer**: Expose `getRequestsByTag` in `requests.service.ts` and `getOffersByTag` in `offers.service.ts`.
4. **Store**: Add methods and state to `requests.store.svelte.ts` and `offers.store.svelte.ts` to manage fetching and storing requests/offers by tag.
5. **UI Page**: Create a new route `/tags/[tag]` that displays two lists: "Requests" and "Offers" associated with that tag.
6. **UI Linking**: Make tags on `ServiceTypeCard`, `RequestDetails`, and `OfferDetails` pages link to the corresponding `/tags/[tag]` page.
7. **Testing**: Add backend (Tryorama) and frontend (Vitest) tests for this new discovery path.

### Phase 4 – Bonus Features (Lower Priority)
1. **TagCloud.svelte** – Generate weighted cloud using `tagStatistics`.
2. Smart suggestions: derive related tags (e.g., via co-occurrence frequency) and suggest them in UI.
3. Performance & analytics dashboards for admins.

### Relevant Files

- **Backend**
  - `dnas/requests_and_offers/zomes/coordinator/service_types/src/service_type.rs` – Add new extern functions ✅
  - `dna.yaml` – Ensure capability grants for new calls (if needed)
- **Services (UI)**
  - `ui/src/lib/services/zomes/serviceTypes.service.ts` – Extend interface & live layer
- **Stores (UI)**
  - `ui/src/lib/stores/serviceTypes.store.svelte.ts` – Add tag-related state & methods
- **Components (UI)**
  - `ui/src/lib/components/service-types/TagAutocomplete.svelte` – NEW
  - `ui/src/lib/components/service-types/TagCloud.svelte` – NEW (bonus)
  - `ui/src/lib/components/service-types/ServiceTypeSelector.svelte` – Enhance
- **Pages / Routes (UI)**
  - `ui/src/routes/(app)/service-types/+page.svelte` – Advanced search panel
  - `ui/src/routes/admin/service-types/+page.svelte` – Tag analytics & filtering
  - `ui/src/routes/tags/[tag]/+page.svelte` – NEW (for Request/Offer discovery)
- **Tests**
  - `tests/src/requests_and_offers/service-types-tests/` – New Rust tests
  - `tests/src/requests_and_offers/requests-tests/` – New Rust tests for tag search
  - `tests/src/requests_and_offers/offers-tests/` – New Rust tests for tag search

---

> **Note:** Tag Cloud & Smart Suggestions are labelled as bonus to prioritise core search functionality first. 

## Test Results Summary

**✅ COMPLETE - All Tests Passing!** - Comprehensive tag-based discovery system fully implemented and tested:

### Backend Tests (Holochain/Rust)
- ✅ **4/4** Tag-based discovery tests passing (Tryorama)
- ✅ Tag indexing and basic retrieval
- ✅ Multi-tag search with intersection logic  
- ✅ Tag prefix search for autocomplete
- ✅ Tag usage statistics
- ✅ Tag cleanup on service type deletion
- ✅ Tag functionality edge cases
- ✅ **Request/Offer tag-based discovery working**

### Frontend Tests (TypeScript/Effect)
- ✅ **17/17** Tag discovery service tests passing
- ✅ **248/248** Total unit tests passing (including stores)
- ✅ **All tag-based store methods** (`getRequestsByTag`, `getOffersByTag`) implemented and tested
- ✅ Null handling, error scenarios, and edge cases covered
- ✅ Mock service integration working correctly 