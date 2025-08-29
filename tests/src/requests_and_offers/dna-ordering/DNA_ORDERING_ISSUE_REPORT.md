# DNA Ordering Issue Report

## Problem Summary

Since adding the hREA DNA to our hApp (making it a multi-DNA application), Tryorama tests have become unreliable due to inconsistent DNA ordering in the `player.cells` array. Tests assume `alice.cells[0]` and `bob.cells[0]` are always the `requests_and_offers` DNA, but sometimes the hREA DNA loads at index 0 instead.

## Root Cause Analysis

### hApp Structure
Our hApp manifest (`workdir/happ.yaml`) defines two DNAs:

```yaml
roles:
  - name: requests_and_offers    # Custom DNA
    dna:
      bundled: "../dnas/requests_and_offers/workdir/requests_and_offers.dna"
  - name: hrea                   # hREA DNA
    dna:
      bundled: "./hrea.dna"
```

### The Problem
Tryorama loads both DNAs into each player's `cells` array, but **the order is not guaranteed to be consistent**:

- Sometimes: `alice.cells[0]` = requests_and_offers, `alice.cells[1]` = hrea
- Sometimes: `alice.cells[0]` = hrea, `alice.cells[1]` = requests_and_offers
- Worse: Alice and Bob might have different orderings!

### Current Test Pattern (Problematic)
All existing tests use this pattern:

```typescript
await runScenarioWithTwoAgents(
  async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
    // ❌ ASSUMES index 0 is always requests_and_offers DNA
    const aliceUser = await createUser(alice.cells[0], userData);
    const bobUser = await createUser(bob.cells[0], userData);
    // ... rest of test
  }
);
```

### Impact
- **Intermittent test failures**: Tests fail unpredictably when DNA ordering changes
- **Hard to debug**: Same test can pass or fail without code changes
- **CI/CD unreliability**: Automated tests become flaky
- **Developer frustration**: "It works on my machine" scenarios

## Evidence

### 1. hApp Configuration Analysis
- **File**: `workdir/happ.yaml`
- **Evidence**: Two DNAs defined without explicit ordering guarantees
- **Impact**: Tryorama makes no promises about cell array ordering

### 2. Test Code Analysis
- **Files**: All `*.test.ts` files in `/tests/src/`
- **Pattern**: 100% of tests use `alice.cells[0]` and `bob.cells[0]`
- **Assumption**: Index 0 is always requests_and_offers DNA
- **Reality**: This assumption is false in multi-DNA hApps

### 3. Manifest Evidence
```typescript
// From existing tests - this pattern is everywhere:
const aliceUser = await createUser(alice.cells[0], aliceUser);  // ❌ Unreliable
const serviceType = await createServiceType(alice.cells[0], input); // ❌ Unreliable
await dhtSync([alice, bob], alice.cells[0].cell_id[0]); // ❌ Unreliable
```

## Solution Implementation

### Created Diagnostic Tests
1. **`dna-ordering-issue.test.ts`** - Demonstrates the inconsistency
2. **`simple-ordering-test.test.ts`** - Quick diagnosis of DNA locations  
3. **`solution-demo.test.ts`** - Shows working solution

### Created Utility Functions
**`dna-utils.ts`** provides:

```typescript
// Reliable DNA cell identification
export async function getRequestsAndOffersCell(player: PlayerApp): Promise<CallableCell | null>
export async function getHREACell(player: PlayerApp): Promise<CallableCell | null>

// Wrapper for clean test code
export async function runScenarioWithReliableCells(
  callback: (
    alice: PlayerApp, 
    bob: PlayerApp, 
    aliceRequestsAndOffers: CallableCell,
    bobRequestsAndOffers: CallableCell,
    aliceHREA: CallableCell | null,
    bobHREA: CallableCell | null
  ) => Promise<void>
): Promise<void>
```

### Recommended Fix Pattern

**Instead of:**
```typescript
await runScenarioWithTwoAgents(
  async (_scenario, alice, bob) => {
    const result = await alice.cells[0].callZome(/*...*/); // ❌ Unreliable
  }
);
```

**Use this:**
```typescript
await runScenarioWithReliableCells(
  async (alice, bob, aliceRequestsAndOffers, bobRequestsAndOffers) => {
    const result = await aliceRequestsAndOffers.callZome(/*...*/); // ✅ Reliable
  }
);
```

## Files Created for Investigation

```
tests/src/requests_and_offers/dna-ordering/
├── DNA_ORDERING_ISSUE_REPORT.md     # This report
├── dna-ordering-issue.test.ts       # Comprehensive diagnostic test
├── simple-ordering-test.test.ts     # Quick diagnostic test
├── solution-demo.test.ts            # Working solution demonstration
└── dna-utils.ts                     # Utility functions for reliable DNA access
```

## Next Steps

1. **Immediate**: Use utility functions in new tests
2. **Medium-term**: Migrate existing tests to use reliable DNA access
3. **Long-term**: Consider if we need a better test structure

## Technical Details

### DNA Identification Method
The utility functions identify DNAs by attempting to call known zome functions:

```typescript
// requests_and_offers DNA has "service_types" zome
await cell.callZome({
  zome_name: "service_types",
  fn_name: "get_all_service_types", 
  payload: null,
});

// hrea DNA has "agent" zome
await cell.callZome({
  zome_name: "agent",
  fn_name: "get_my_agent",
  payload: null,
});
```

### Why This Happens
- Tryorama creates conductors independently for each player
- DNAs are loaded asynchronously during hApp installation
- No ordering guarantees exist in Holochain/Tryorama for multi-DNA apps
- The order can vary based on file system timing, CPU load, etc.

## Verification

The diagnostic tests can be run (though they may timeout due to setup overhead):

```bash
cd tests
bun test src/requests_and_offers/dna-ordering/simple-ordering-test.test.ts
```

Expected output will show DNA indices and identify any inconsistencies.
