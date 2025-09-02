# namedCells Migration Guide

**Critical Solution for Multi-DNA Tryorama Test Reliability**

## The Problem

In multi-DNA Holochain applications, accessing cells via array indices (`alice.cells[0]`, `alice.cells[1]`) is unreliable because DNA loading order is **non-deterministic**. This causes flaky tests that pass or fail unpredictably.

## The Solution: namedCells

Tryorama provides `namedCells` - a Map that allows accessing cells by their role name from the hApp manifest. This is the **official and reliable** method for multi-DNA applications.

## Our hApp Structure

From `workdir/happ.yaml`:
```yaml
roles:
  - name: requests_and_offers    # ← This becomes a namedCells key
    dna:
      bundled: "../dnas/requests_and_offers/workdir/requests_and_offers.dna"
  - name: hrea                   # ← This becomes a namedCells key  
    dna:
      bundled: "./hrea.dna"
```

## Migration Patterns

### ❌ BEFORE (Unreliable)
```typescript
await runScenarioWithTwoAgents(
  async (_scenario, alice, bob) => {
    // PROBLEM: Assumes cells[0] is always requests_and_offers
    const aliceUser = await createUser(alice.cells[0], userData);
    const bobUser = await createUser(bob.cells[0], userData);
    
    // Could fail if hrea DNA loads at index 0 instead
    const result = await alice.cells[0].callZome({
      zome_name: "service_types", // This would fail if cells[0] is hrea DNA
      fn_name: "create_service_type",
      payload: serviceTypeData
    });
  }
);
```

### ✅ AFTER (Reliable)
```typescript
await runScenarioWithTwoAgents(
  async (_scenario, alice, bob) => {
    // SOLUTION: Access cells by role name
    const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
    const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;
    
    // Optional: Access hrea DNA if needed
    const aliceHREA = alice.namedCells.get("hrea")!;
    const bobHREA = bob.namedCells.get("hrea")!;
    
    const aliceUser = await createUser(aliceRequestsAndOffers, userData);
    const bobUser = await createUser(bobRequestsAndOffers, userData);
    
    // Always calls the correct DNA
    const result = await aliceRequestsAndOffers.callZome({
      zome_name: "service_types",
      fn_name: "create_service_type", 
      payload: serviceTypeData
    });
  }
);
```

## Key Benefits

1. **Deterministic**: Always returns the correct cell for the specified role
2. **Self-Documenting**: Code clearly shows which DNA is being accessed
3. **Maintainable**: Immune to hApp manifest changes or DNA loading order
4. **Official**: This is the Tryorama-recommended approach

## Migration Checklist

### Step 1: Find All Problematic Patterns
```bash
cd tests
grep -r "\.cells\[0\]" --include="*.test.ts" .
grep -r "\.cells\[1\]" --include="*.test.ts" .
```

### Step 2: Replace Patterns
- `alice.cells[0]` → `alice.namedCells.get("requests_and_offers")!`
- `bob.cells[0]` → `bob.namedCells.get("requests_and_offers")!`
- `alice.cells[1]` → `alice.namedCells.get("hrea")!`
- `bob.cells[1]` → `bob.namedCells.get("hrea")!`

### Step 3: Common Function Updates
Update helper functions to accept the specific cells:

```typescript
// Before
async function createUser(cell: CallableCell, userData: User) {
  return await cell.callZome({
    zome_name: "users_organizations",
    fn_name: "create_user", 
    payload: userData
  });
}

// Usage Before
const user = await createUser(alice.cells[0], userData); // ❌ Unreliable

// Usage After  
const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
const user = await createUser(aliceRequestsAndOffers, userData); // ✅ Reliable
```

## Files That Need Migration

Based on grep search, these files use the problematic `cells[0]` pattern:

```
./src/requests_and_offers/requests-tests/requests.test.ts
./src/requests_and_offers/service-types-tests/status/access-control.test.ts  
./src/requests_and_offers/service-types-tests/status/linking-enforcement.test.ts
./src/requests_and_offers/service-types-tests/status/edge-cases.test.ts
./src/requests_and_offers/service-types-tests/status/user-suggestion.test.ts
./src/requests_and_offers/service-types-tests/status/admin-moderation.test.ts
./src/requests_and_offers/service-types-tests/tag-functionality.test.ts
./src/requests_and_offers/service-types-tests/tag-based-discovery.test.ts
./src/requests_and_offers/service-types-tests/service-types-integration.test.ts
./src/requests_and_offers/service-types-tests/service-types.test.ts
./src/requests_and_offers/exchanges-tests/exchanges.test.ts
./src/requests_and_offers/users/users.test.ts
./src/requests_and_offers/organizations/organizations.test.ts
./src/requests_and_offers/mediums-of-exchange-tests/mediums-of-exchange.test.ts
./src/requests_and_offers/offers-tests/offers.test.ts
```

## Example Migration

### Before (from service-types.test.ts):
```typescript
test("create ServiceType", async () => {
  await runScenarioWithTwoAgents(async (scenario, alice, bob) => {
    const serviceType = await createServiceType(alice.cells[0], sample);
    //                                           ^^^^^^^^^^^^^ ❌ Unreliable
  });
});
```

### After:
```typescript
test("create ServiceType", async () => {
  await runScenarioWithTwoAgents(async (scenario, alice, bob) => {
    const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
    const serviceType = await createServiceType(aliceRequestsAndOffers, sample);
    //                                          ^^^^^^^^^^^^^^^^^^^^^ ✅ Reliable
  });
});
```

## Testing the Migration

### Validation Test
The test at `src/requests_and_offers/dna-ordering/namedcells-solution.test.ts` validates:

1. `namedCells` Map exists and contains expected keys
2. Cells can be accessed by role name  
3. Different DNA cells have different identities
4. Zome calls work correctly on the accessed cells
5. Comparison with old unreliable approach

### Running Validation (when environment fixed)
```bash
cd tests
npx vitest run src/requests_and_offers/dna-ordering/namedcells-solution.test.ts
```

## Technical Notes

### Type Safety
```typescript
// namedCells returns CallableCell | undefined
const cell = alice.namedCells.get("requests_and_offers"); // CallableCell | undefined

// Use ! operator for known cells from hApp manifest
const cell = alice.namedCells.get("requests_and_offers")!; // CallableCell

// Or handle undefined case
const cell = alice.namedCells.get("requests_and_offers");
if (!cell) throw new Error("Cell not found");
```

### Available Keys
The `namedCells` Map keys match the role names in `happ.yaml`:
- `"requests_and_offers"` - Our custom DNA
- `"hrea"` - The hREA DNA

### Cell ID Access
```typescript
const cell = alice.namedCells.get("requests_and_offers")!;
const cellId = cell.cell_id; // [DnaHash, AgentPubKey]
const dnaHash = cell.cell_id[0];
const agentPubKey = cell.cell_id[1];
```

## Conclusion

The `namedCells` approach eliminates test flakiness caused by non-deterministic DNA ordering. It's the official, reliable way to access cells in multi-DNA Tryorama tests.

**All new tests should use `namedCells` from the start.**  
**Existing tests should be systematically migrated when test environment issues are resolved.**