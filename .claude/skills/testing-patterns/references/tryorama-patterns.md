# Tryorama Integration Test Patterns

## Test Setup with Two Agents

```typescript
import { runScenarioWithTwoAgents, decodeRecords, decodeRecord, extractWasmErrorMessage } from './utils';
import { dhtSync } from '@holochain/tryorama';

it('multi-agent scenario', async () => {
  await runScenarioWithTwoAgents(async (scenario, alice, bob) => {
    // Access DNA cells
    const aliceCells = alice.namedCells.get('requests_and_offers');
    const bobCells = bob.namedCells.get('requests_and_offers');

    // ... test logic
  });
});
```

## runScenarioWithTwoAgents Implementation

From `tests/src/requests_and_offers/utils.ts`:

```typescript
export async function runScenarioWithTwoAgents(
  callback: (scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => Promise<void>
): Promise<void> {
  await runScenario(async (scenario) => {
    const [alice, bob] = await scenario.addPlayersWithApps([appSource, appSource]);
    await scenario.shareAllAgents();
    await callback(scenario, alice, bob);
    scenario.cleanUp();
  });
}
```

## Zome Calls

```typescript
const record = await aliceCells.callZome({
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
const record = await aliceCells.callZome({ ... });

// MUST sync before Bob can read
await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

// Now Bob can read Alice's data
const result = await bobCells.callZome({ ... });
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
- Use `namedCells.get('requests_and_offers')` to access DNA cells
- Decode records with `@msgpack/msgpack` `decode()`
- Extract Wasm errors with `extractWasmErrorMessage()`
- Tests are in `tests/src/requests_and_offers/` directory
- Run with `bun test` (includes zome build) or specific: `bun test:requests`
