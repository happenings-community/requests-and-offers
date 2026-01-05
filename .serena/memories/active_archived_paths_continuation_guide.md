# Active/Archived Paths - Continuation Guide

## Quick Session Resume

To continue this work in the next session:

1. **Read the plan:**
   ```bash
   cat documentation/tasks-lists/ACTIVE_ARCHIVED_PATHS_PLAN.md
   ```

2. **Load Serena memories:**
   ```bash
   /sc:load
   ```

3. **Verify current status:**
   - Phases 0-5: ✅ COMPLETED
   - Phase 6: ⏳ PENDING (Tryorama tests)
   - Phase 7: ⏳ PENDING (Validation)

## Immediate Next Steps

### Step 1: Fix the Conductor Cache Issue

**Problem:** Offers/requests appear in MyListings but not in main pages.

**Solution:**
```bash
cd /home/soushi888/Projets/Holochain/requests-and-offers

# Stop any running server
pkill -f "bun start" || true

# Clear Holochain conductor cache
rm -rf ui/.holochain

# Restart development server
bun start
```

**Verify Fix:**
1. Create a new offer or request
2. Check it appears in both:
   - MyListings page (`/my-listings`)
   - Main offers/requests page (`/offers` or `/requests`)

### Step 2: Continue with Phase 6

Once cache issue is resolved, update Tryorama tests:

**Files to Modify:**
- `tests/offers/test-offers.ts`
- `tests/requests/test-requests.ts`

**Key Test Updates:**
1. Update create tests to verify `"*.active"` path usage
2. Update archive tests to verify path movement
3. Add tests for new `get_archived_*()` functions
4. Update link type assertions

**Run Tests:**
```bash
bun test
```

### Step 3: Complete Phase 7

Final validation and testing:
- Verify all functionality works end-to-end
- Check performance improvements
- Document any issues
- Mark implementation complete

## Important Commands Reference

```bash
# Build zomes (from project root)
bun build:zomes

# TypeScript check (from ui/)
cd ui && bun run check

# Run all tests
bun test

# Run specific test category
bun test:offers
bun test:requests

# Start development server
bun start          # 2 agents, dev features
bun start:test     # Test mode
bun start:prod     # Production mode
```

## Key Files to Reference

### Implementation Plan
- `ACTIVE_ARCHIVED_PATHS_PLAN.md` - Complete plan with all phases

### Backend
- `dnas/requests_and_offers/zomes/coordinator/offers/src/offer.rs:52-60` - Create function
- `dnas/requests_and_offers/zomes/coordinator/offers/src/offer.rs:161-186` - Query function

### Frontend
- `ui/src/lib/services/zomes/offers.service.ts` - Service interface
- `ui/src/lib/stores/offers.store.svelte.ts` - Store implementation
- `ui/src/lib/composables/domain/offers/useOffersManagement.svelte.ts` - Management logic

## Session Context

**Last Work:** Phase 5 completion - renamed all frontend methods from `getAll*` to `getActive*`

**Current Blocker:** Conductor cache causing new offers/requests to not appear in main pages

**Next Task:** Apply cache fix, then continue with Phase 6 (Tryorama tests)

**Estimated Remaining Work:**
- Phase 6: 2-3 hours
- Phase 7: 1-2 hours
- Total: 3-5 hours to completion

## Troubleshooting Quick Reference

### Issue: Offers not appearing in main list
**Cause:** Conductor cache needs clearing
**Fix:** `rm -rf ui/.holochain && bun start`

### Issue: TypeScript errors after rename
**Cause:** Missed occurrence of old method name
**Fix:** Run `bun run check` to find errors

### Issue: Tests failing
**Cause:** Tests still using old function names or paths
**Fix:** Update test assertions to match new path structure

### Issue: Archive not moving items
**Cause:** Backend archive function not properly moving links
**Fix:** Verify lines 577-613 in offer.rs (similar for request.rs)

## Success Criteria

Implementation is complete when:
- [ ] All offers/requests created go to `"*.active"` paths
- [ ] Archive moves items from `"*.active"` to `"*.archived"`
- [ ] Main pages show only active items
- [ ] MyListings shows correct items in each tab
- [ ] All Tryorama tests pass
- [ ] No console errors
- [ ] Performance noticeably improved

## Rollback Plan

If critical issues arise:
1. Revert backend to single-path approach (lines 52-60 in offer.rs)
2. Revert frontend to `getAll*` method names
3. Clear conductor cache
4. Restart server

**Rollback time:** ~15 minutes
