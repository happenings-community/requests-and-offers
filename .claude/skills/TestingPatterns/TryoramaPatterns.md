# Tryorama Integration Test Patterns

## Running Tests (Verified)

**Tryorama tests require Nix shell** — `holochain` and `hc` binaries are only available via `nix develop`.

```bash
# All integration tests (from project root, inside nix shell)
nix develop --command bash -c "bun run --filter tests test"

# Specific domain (add -- <filter> matching directory name)
nix develop --command bash -c "bun run --filter tests test -- administration"
nix develop --command bash -c "bun run --filter tests test -- users"
nix develop --command bash -c "bun run --filter tests test -- requests-tests"
nix develop --command bash -c "bun run --filter tests test -- organizations"
nix develop --command bash -c "bun run --filter tests test -- service-types-tests"
nix develop --command bash -c "bun run --filter tests test -- offers-tests"
nix develop --command bash -c "bun run --filter tests test -- mediums-of-exchange-tests"

# Quick sanity check (1 test, ~100s) — use this to verify the environment
nix develop --command bash -c "bun run --filter tests test -- misc"

# Build hApp first when Rust code has changed
nix develop --command bash -c "bun run build:happ && bun run --filter tests test"
```

**Common mistake:** `bun t -w tests` (npm-style) does NOT work with bun. Use `bun run --filter tests test`.

**Prerequisite:** `workdir/requests_and_offers.happ` must exist. If missing, run `bun run build:happ` inside nix develop.

## Scenario Functions (from utils.ts)

### runScenarioWithTwoAgents

Standard two-agent test. Alice is automatically set as progenitor (network admin) via DNA properties:

```typescript
import { runScenarioWithTwoAgents, decodeRecords, decodeRecord } from '../utils';
import { dhtSync } from '@holochain/tryorama';

it('multi-agent scenario', async () => {
  await runScenarioWithTwoAgents(async (scenario, alice, bob) => {
    const aliceCell = alice.namedCells.get('requests_and_offers')!;
    const bobCell = bob.namedCells.get('requests_and_offers')!;
    // ... test logic
  });
});
```

### runScenarioWithProgenitor

Use when tests need to verify progenitor-specific behavior (auto-registration as admin, pubkey checks):

```typescript
import { runScenarioWithProgenitor } from '../utils';

it('progenitor scenario', async () => {
  await runScenarioWithProgenitor(async (scenario, alice, bob, alicePubKey) => {
    const aliceCell = alice.namedCells.get('requests_and_offers')!;
    // alicePubKey available for checkIfAgentIsAdministrator, etc.
  });
});
```

## Zome Calls

```typescript
const record = await aliceCell.callZome({
  zome_name: 'requests',
  fn_name: 'create_request',
  payload: {
    request: { title: 'Test', description: 'Test request' },
    organization: null,
    service_type_hashes: [],
    medium_of_exchange_hashes: []
  }
});
```

## DHT Synchronization

Always call `dhtSync` between operations across agents:

```typescript
// Alice creates something
const record = await aliceCell.callZome({ ... });

// MUST sync before Bob can read
await dhtSync([alice, bob], aliceCell.cell_id[0]);

// Now Bob can read Alice's data
const result = await bobCell.callZome({ ... });
```

## Record Decoding

```typescript
import { decode } from '@msgpack/msgpack';

// Single record
export function decodeRecord<T>(record: Record): T {
  return decode((record.entry as any).Present.entry) as T;
}

// Multiple records
export function decodeRecords<T>(records: Record[]): T[] {
  return records.map((r) => decode((r.entry as any).Present.entry)) as T[];
}
```

## Error Extraction

```typescript
export function extractWasmErrorMessage(message: string): WasmError {
  const messageRegex = /Guest\("(.+)"\)/;
  const matched = message.match(messageRegex);
  return {
    type: matched ? 'Guest' : 'Unknown',
    message: matched ? matched[1] : 'Unknown error'
  };
}
```

## Hash Utilities

```typescript
import { Base64 } from 'js-base64';

export function deserializeHash(hash: string): Uint8Array {
  return Base64.toUint8Array(hash.slice(1));
}

export function serializeHash(hash: Uint8Array): string {
  return `u${Base64.fromUint8Array(hash, true)}`;
}
```

## Key Rules

- Always `dhtSync()` between cross-agent operations
- Use `namedCells.get('requests_and_offers')!` to access DNA cells (note the `!` non-null assertion)
- Decode records with `@msgpack/msgpack` `decode()`
- Extract Wasm errors with `extractWasmErrorMessage()`
- Tests are in `tests/src/requests_and_offers/` directory
- Use `-- misc` filter for quick environment validation (1 test, ~100s)
