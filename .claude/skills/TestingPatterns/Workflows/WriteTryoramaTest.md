# WriteTryoramaTest Workflow

Step-by-step guide to writing a Tryorama integration test for Holochain zomes.

## Steps

### 1. Load patterns

Read `TryoramaPatterns.md` from the skill root for full code examples.

### 2. Identify the zome and function to test

- Zome name: e.g., `requests`, `users`, `administration`
- Function name: e.g., `create_request`, `get_user`, `delete_link`
- Payload structure: check the Rust zome coordinator source

### 3. Create or locate the test file

Tests live in: `tests/src/requests_and_offers/{domain}/`

Example file: `tests/src/requests_and_offers/requests/create-request.test.ts`

### 4. Set up two-agent scenario

Use `runScenarioWithTwoAgents` for standard tests. Use `runScenarioWithProgenitor` when testing admin/progenitor-specific behavior (it provides `alicePubKey` as 4th callback arg):

```typescript
import { runScenarioWithTwoAgents, decodeRecord, decodeRecords } from '../utils';
import { dhtSync } from '@holochain/tryorama';

it('should {action}', async () => {
  await runScenarioWithTwoAgents(async (scenario, alice, bob) => {
    const aliceCell = alice.namedCells.get('requests_and_offers')!;
    const bobCell = bob.namedCells.get('requests_and_offers')!;

    // ... test logic
  });
});
```

### 5. Make zome calls

```typescript
const record = await aliceCell.callZome({
  zome_name: '{zome_name}',
  fn_name: '{fn_name}',
  payload: { /* payload matching Rust struct */ }
});
```

### 6. Sync DHT before cross-agent reads

```typescript
// Alice creates
const record = await aliceCell.callZome({ ... });

// MANDATORY before Bob reads
await dhtSync([alice, bob], aliceCell.cell_id[0]);

// Bob reads
const result = await bobCell.callZome({ ... });
```

### 7. Decode results

```typescript
import { decodeRecord, decodeRecords } from '../utils';

// Single record
const decoded = decodeRecord<MyType>(record);

// Multiple records
const decoded = decodeRecords<MyType>(records);
```

### 8. Assert results

```typescript
expect(decoded.title).toBe('Expected title');
expect(decoded.description).toBeDefined();
```

### 9. Test error cases (Wasm errors)

```typescript
import { extractWasmErrorMessage } from '../utils';

await expect(
  aliceCell.callZome({ zome_name: '{zome}', fn_name: '{fn}', payload: invalidInput })
).rejects.toThrow();

// Or check the Wasm error message
try {
  await aliceCell.callZome({ ... });
} catch (e) {
  const wasmError = extractWasmErrorMessage(e.message);
  expect(wasmError.type).toBe('Guest');
  expect(wasmError.message).toContain('expected error text');
}
```

### 10. Run the test

**Must run inside Nix shell.** Use `bun run --filter tests test` (not `bun t -w tests`):

```bash
# All integration tests:
nix develop --command bash -c "bun run --filter tests test"

# Your specific domain:
nix develop --command bash -c "bun run --filter tests test -- {domain}"

# Quick sanity check (misc — 1 test, ~100s):
nix develop --command bash -c "bun run --filter tests test -- misc"

# If Rust code changed, build first:
nix develop --command bash -c "bun run build:happ && bun run --filter tests test -- {domain}"
```

## Reference

- Full patterns: `TryoramaPatterns.md`
- Utils: `tests/src/requests_and_offers/utils.ts`
- Real examples: `tests/src/requests_and_offers/` directory
