# Backend Testing Standards

This document provides comprehensive guidelines for backend testing in the requests-and-offers project using Tryorama, Holochain, and multi-agent testing patterns.

## Technology Stack

- **Tryorama**: Multi-agent Holochain testing framework
- **Vitest**: Test runner and assertion library for TypeScript
- **@holochain/client**: Mock utilities and client library for testing
- **Holochain**: Peer-to-peer application framework
- **Rust**: Backend implementation language

## Testing Architecture

### Backend Test Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│ Multi-Agent Scenarios (Tryorama)                            │
│   - Cross-agent data consistency                           │
│   - Permission enforcement testing                         │
│   - Network synchronization testing                        │
├─────────────────────────────────────────────────────────────┤
│ DNA Integration Testing                                     │
│   - Zome function testing                                  │
│   - Entry validation testing                              │
│   - Link validation testing                               │
├─────────────────────────────────────────────────────────────┤
│ Business Logic Testing                                     │
│   - Domain rule validation                               │
│   - Status transition testing                            │
│   - Permission boundary testing                          │
├─────────────────────────────────────────────────────────────┤
│ Cross-Validation Testing                                   │
│   - Data consistency across agents                       │
│   - Referential integrity testing                        │
│   - Concurrency testing                                  │
├─────────────────────────────────────────────────────────────┤
│ Permission & Authorization Testing                        │
│   - Access control validation                            │
│   - Role-based permission testing                       │
│   - Administrative operation testing                     │
├─────────────────────────────────────────────────────────────┤
│ API Contract Testing                                       │
│   - Zome function interface testing                     │
│   - Input/output validation testing                     │
│   - Error handling testing                              │
├─────────────────────────────────────────────────────────────┤
│ Unit Testing (Rust)                                        │
│   - Pure function testing                               │
│   - Entry definition testing                            │
│   - Validation function testing                        │
└─────────────────────────────────────────────────────────────┘
```

## Tryorama Testing Patterns

### Multi-Agent Scenario Setup

#### Basic Test Template
```typescript
// tests/src/requests_and_offers/requests-tests/requests.test.ts
import { assert, expect, test } from "vitest";
import { Scenario, Player, dhtSync, PlayerApp } from "@holochain/tryorama";
import { runScenarioWithTwoAgents } from "../utils";
import {
  createUser,
  getAgentUser,
  sampleUser,
} from "../users/common";
import {
  createRequest,
  deleteRequest,
  getAllRequests,
  getLatestRequest,
  updateRequest,
  sampleRequest,
} from "./common";

test("basic request operations", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Arrange - Access DNA cells
      const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
      const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

      // Arrange - Create and setup users
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
      assert.ok(aliceUserRecord);

      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bobRequestsAndOffers, bobUser);
      assert.ok(bobUserRecord);

      // Arrange - Setup admin permissions
      await setupNetworkAdministrator(aliceRequestsAndOffers, alice.agentPubKey);

      // Sync after setup
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Act - Create request
      const request = sampleRequest();
      const requestRecord = await createRequest(
        aliceRequestsAndOffers,
        request
      );
      assert.ok(requestRecord);

      // Sync after creation
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Assert - Verify creation and permissions
      const allRequests = await getAllRequests(aliceRequestsAndOffers);
      assert.lengthOf(allRequests, 1);

      // Assert - Verify permission boundaries
      await expect(
        updateRequest(
          bobRequestsAndOffers,
          requestRecord.signed_action.hashed.hash,
          requestRecord.signed_action.hashed.hash,
          { ...request, title: "Bob's update" }
        )
      ).rejects.toThrow();

      // Assert - Verify successful update by owner
      const updatedRecord = await updateRequest(
        aliceRequestsAndOffers,
        requestRecord.signed_action.hashed.hash,
        requestRecord.signed_action.hashed.hash,
        { ...request, title: "Updated by Alice" }
      );
      assert.ok(updatedRecord);

      // Sync and verify consistency
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      const latestRequest = await getLatestRequest(
        bobRequestsAndOffers,
        requestRecord.signed_action.hashed.hash
      );
      assert.equal(latestRequest.title, "Updated by Alice");
    }
  );
});
```

#### Scenario Setup Utilities
```typescript
// tests/src/utils.ts
import { Scenario, Player, PlayerApp } from "@holochain/tryorama";
import { registerNetworkAdministrator } from "./requests_and_offers/administration/common";

export async function runScenarioWithTwoAgents(
  testFn: (scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => Promise<void>
) {
  const scenario = new Scenario();

  const alice = await scenario.addPlayer({
    name: "alice",
    appBundleSource: { path: "../../path/to/requests_and_offers.happ" }
  });

  const bob = await scenario.addPlayer({
    name: "bob",
    appBundleSource: { path: "../../path/to/requests_and_offers.happ" }
  });

  try {
    await testFn(scenario, alice, bob);
  } finally {
    await scenario.shutdown();
  }
}

export async function runScenarioWithThreeAgents(
  testFn: (scenario: Scenario, alice: PlayerApp, bob: PlayerApp, carol: PlayerApp) => Promise<void>
) {
  const scenario = new Scenario();

  const alice = await scenario.addPlayer({
    name: "alice",
    appBundleSource: { path: "../../path/to/requests_and_offers.happ" }
  });

  const bob = await scenario.addPlayer({
    name: "bob",
    appBundleSource: { path: "../../path/to/requests_and_offers.happ" }
  });

  const carol = await scenario.addPlayer({
    name: "carol",
    appBundleSource: { path: "../../path/to/requests_and_offers.happ" }
  });

  try {
    await testFn(scenario, alice, bob, carol);
  } finally {
    await scenario.shutdown();
  }
}

export async function setupTestUsers(
  aliceCell: any,
  bobCell: any,
  aliceAgentPubKey: any,
  bobAgentPubKey: any
) {
  // Create users
  const aliceUser = sampleUser({ name: "Alice" });
  const aliceUserRecord = await createUser(aliceCell, aliceUser);

  const bobUser = sampleUser({ name: "Bob" });
  const bobUserRecord = await createUser(bobCell, bobUser);

  // Make Alice admin
  const aliceUserLink = (await getAgentUser(aliceCell, aliceAgentPubKey))[0];
  await registerNetworkAdministrator(
    aliceCell,
    aliceUserLink.target,
    [aliceAgentPubKey]
  );

  // Accept both users
  await acceptUsers(aliceCell, [aliceUserRecord, bobUserRecord]);

  return { aliceUserRecord, bobUserRecord };
}

export async function setupTestEnvironment(
  players: PlayerApp[],
  testCellId: Uint8Array
) {
  // Sync all players
  await dhtSync(players, testCellId);

  // Additional setup common to all tests
  return { players, testCellId };
}
```

### Cross-Validation Testing

#### Data Consistency Testing
```typescript
test("data consistency across agents", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario, alice, bob) => {
      const aliceCell = alice.namedCells.get("requests_and_offers")!;
      const bobCell = bob.namedCells.get("requests_and_offers")!;

      // Create data on Alice
      const request = sampleRequest();
      const aliceRecord = await createRequest(aliceCell, request);

      // Sync
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      // Verify Bob can see the same data
      const bobRecord = await getLatestRequest(
        bobCell,
        aliceRecord.signed_action.hashed.hash
      );

      // Cross-validate data integrity
      expect(bobRecord).toEqual(aliceRecord.entry);
      expect(bobRecord.signed_action.hashed.hash).toEqual(
        aliceRecord.signed_action.hashed.hash
      );

      // Verify timestamps are consistent
      expect(bobRecord.action().timestamp()).toEqual(
        aliceRecord.action().timestamp()
      );
    }
  );
});
```

#### Referential Integrity Testing
```typescript
test("referential integrity across linked entities", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario, alice, bob) => {
      const aliceCell = alice.namedCells.get("requests_and_offers")!;
      const bobCell = bob.namedCells.get("requests_and_offers")!;

      // Create service type
      const serviceType = sampleServiceType();
      const serviceRecord = await createServiceType(aliceCell, serviceType);

      // Create request linked to service type
      const request = sampleRequest();
      const requestRecord = await createRequest(
        aliceCell,
        request,
        undefined,
        [serviceRecord.signed_action.hashed.hash]
      );

      // Sync
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      // Verify link integrity from Bob's perspective
      const requestsForService = await getRequestsForServiceType(
        bobCell,
        serviceRecord.signed_action.hashed.hash
      );
      assert.lengthOf(requestsForService, 1);
      assert.equal(
        requestsForService[0].signed_action.hashed.hash,
        requestRecord.signed_action.hashed.hash
      );

      // Verify reverse link
      const serviceTypesForRequest = await getServiceTypesForRequest(
        bobCell,
        requestRecord.signed_action.hashed.hash
      );
      assert.lengthOf(serviceTypesForRequest, 1);
      assert.equal(
        serviceTypesForRequest[0],
        serviceRecord.signed_action.hashed.hash
      );
    }
  );
});
```

### Permission Testing

#### Authorization Boundary Testing
```typescript
test("permission enforcement across entities", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario, alice, bob) => {
      const aliceCell = alice.namedCells.get("requests_and_offers")!;
      const bobCell = bob.namedCells.get("requests_and_offers")!;

      // Setup users and permissions
      const { aliceUserRecord, bobUserRecord } = await setupTestUsers(
        aliceCell,
        bobCell,
        alice.agentPubKey,
        bob.agentPubKey
      );

      // Alice creates request
      const request = sampleRequest();
      const requestRecord = await createRequest(
        aliceCell,
        request,
        aliceUserRecord.signed_action.hashed.hash
      );

      // Sync
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      // Test 1: Bob cannot modify Alice's request
      await expect(
        updateRequest(
          bobCell,
          requestRecord.signed_action.hashed.hash,
          requestRecord.signed_action.hashed.hash,
          { ...request, title: "Modified by Bob" },
          bobUserRecord.signed_action.hashed.hash
        )
      ).rejects.toThrow("Unauthorized");

      // Test 2: Alice can modify her own request
      const updatedRecord = await updateRequest(
        aliceCell,
        requestRecord.signed_action.hashed.hash,
        requestRecord.signed_action.hashed.hash,
        { ...request, title: "Modified by Alice" },
        aliceUserRecord.signed_action.hashed.hash
      );
      assert.ok(updatedRecord);

      // Test 3: Setup Alice as admin
      await setupNetworkAdministrator(aliceCell, alice.agentPubKey);
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      // Test 4: Admin can modify other user's requests
      const adminUpdate = await updateRequest(
        aliceCell,
        requestRecord.signed_action.hashed.hash,
        updatedRecord.signed_action.hashed.hash,
        { ...request, title: "Modified by admin" },
        aliceUserRecord.signed_action.hashed.hash
      );
      assert.ok(adminUpdate);

      // Test 5: Verify Bob can see admin changes
      const bobView = await getLatestRequest(
        bobCell,
        requestRecord.signed_action.hashed.hash
      );
      assert.equal(bobView.title, "Modified by admin");
    }
  );
});
```

### Status Management Testing

#### Status Transition Testing
```typescript
test("service type status transitions", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario, alice, bob) => {
      const aliceCell = alice.namedCells.get("requests_and_offers")!;
      const bobCell = bob.namedCells.get("requests_and_offers")!;

      // Setup admin
      await setupNetworkAdministrator(aliceCell, alice.agentPubKey);
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      // Test 1: Create pending service type
      const serviceType = sampleServiceType();
      const pendingRecord = await suggestServiceType(aliceCell, serviceType);
      assert.ok(pendingRecord);

      // Verify initial status
      const pendingStatus = await getServiceTypeStatus(
        aliceCell,
        pendingRecord.signed_action.hashed.hash
      );
      assert.equal(pendingStatus, "pending");

      // Sync
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      // Test 2: Approve service type
      await approveServiceType(aliceCell, pendingRecord.signed_action.hashed.hash);
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      // Verify approved status
      const approvedStatus = await getServiceTypeStatus(
        bobCell,
        pendingRecord.signed_action.hashed.hash
      );
      assert.equal(approvedStatus, "approved");

      // Test 3: Try to reject approved service type (should succeed)
      await rejectServiceType(aliceCell, pendingRecord.signed_action.hashed.hash);
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      // Verify rejected status
      const rejectedStatus = await getServiceTypeStatus(
        aliceCell,
        pendingRecord.signed_action.hashed.hash
      );
      assert.equal(rejectedStatus, "rejected");

      // Test 4: Try to approve rejected service type (should succeed)
      await approveServiceType(aliceCell, pendingRecord.signed_action.hashed.hash);
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      // Verify final approved status
      const finalStatus = await getServiceTypeStatus(
        bobCell,
        pendingRecord.signed_action.hashed.hash
      );
      assert.equal(finalStatus, "approved");
    }
  );
});
```

### Concurrency Testing

#### Concurrent Operations Testing
```typescript
test("concurrent request creation and updates", async () => {
  await runScenarioWithThreeAgents(
    async (_scenario, alice, bob, carol) => {
      const aliceCell = alice.namedCells.get("requests_and_offers")!;
      const bobCell = bob.namedCells.get("requests_and_offers")!;
      const carolCell = carol.namedCells.get("requests_and_offers")!;

      // Setup users
      await setupTestUsers(
        aliceCell,
        bobCell,
        alice.agentPubKey,
        bob.agentPubKey
      );
      await setupTestUsers(
        aliceCell,
        carolCell,
        alice.agentPubKey,
        carol.agentPubKey
      );

      // Test 1: Concurrent request creation
      const createPromises = Array.from({ length: 10 }, (_, i) =>
        createRequest(
          i % 2 === 0 ? aliceCell : bobCell,
          sampleRequest({ title: `Request ${i}` })
        )
      );

      const createdRecords = await Promise.all(createPromises);
      assert.lengthOf(createdRecords, 10);

      // Sync all agents
      await dhtSync([alice, bob, carol], aliceCell.cell_id[0]);

      // Verify all requests are visible to all agents
      const aliceAllRequests = await getAllRequests(aliceCell);
      const bobAllRequests = await getAllRequests(bobCell);
      const carolAllRequests = await getAllRequests(carolCell);

      assert.lengthOf(aliceAllRequests, 10);
      assert.lengthOf(bobAllRequests, 10);
      assert.lengthOf(carolAllRequests, 10);

      // Test 2: Concurrent updates (should fail for non-owners)
      const updatePromises = createdRecords.map((record, i) =>
        updateRequest(
          i % 2 === 0 ? bobCell : aliceCell, // Different agent trying to update
          record.signed_action.hashed.hash,
          record.signed_action.hashed.hash,
          { title: `Updated ${i}` }
        ).catch(err => err) // Catch errors for unauthorized updates
      );

      const updateResults = await Promise.all(updatePromises);

      // Count successful vs failed updates
      const successfulUpdates = updateResults.filter(result =>
        !(result instanceof Error)
      );
      const failedUpdates = updateResults.filter(result =>
        result instanceof Error
      );

      // Should have some failures due to permission checks
      expect(failedUpdates.length).toBeGreaterThan(0);
      expect(successfulUpdates.length).toBeGreaterThan(0);

      // Final sync
      await dhtSync([alice, bob, carol], aliceCell.cell_id[0]);
    }
  );
});
```

### Network Partition Testing

#### Partition Recovery Testing
```typescript
test("network partition and recovery", async () => {
  await runScenarioWithThreeAgents(
    async (_scenario, alice, bob, carol) => {
      const aliceCell = alice.namedCells.get("requests_and_offers")!;
      const bobCell = bob.namedCells.get("requests_and_offers")!;
      const carolCell = carol.namedCells.get("requests_and_offers")!;

      // Initial sync
      await dhtSync([alice, bob, carol], aliceCell.cell_id[0]);

      // Create data on Alice
      const request = sampleRequest();
      const aliceRecord = await createRequest(aliceCell, request);

      // Sync Alice and Bob only (simulate partition from Carol)
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      // Verify Alice and Bob see the data
      const aliceRequests = await getAllRequests(aliceCell);
      const bobRequests = await getAllRequests(bobCell);
      assert.lengthOf(aliceRequests, 1);
      assert.lengthOf(bobRequests, 1);

      // Carol should not see the data yet
      const carolRequests = await getAllRequests(carolCell);
      assert.lengthOf(carolRequests, 0);

      // Update data while partitioned
      const updatedRecord = await updateRequest(
        aliceCell,
        aliceRecord.signed_action.hashed.hash,
        aliceRecord.signed_action.hashed.hash,
        { ...request, title: "Updated during partition" }
      );

      // Sync Alice and Bob
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      // Verify Alice and Bob see updates
      const aliceUpdated = await getLatestRequest(
        aliceCell,
        aliceRecord.signed_action.hashed.hash
      );
      const bobUpdated = await getLatestRequest(
        bobCell,
        aliceRecord.signed_action.hashed.hash
      );
      assert.equal(aliceUpdated.title, "Updated during partition");
      assert.equal(bobUpdated.title, "Updated during partition");

      // Recover partition - sync all agents
      await dhtSync([alice, bob, carol], aliceCell.cell_id[0]);

      // Verify Carol now sees all data
      const carolRecovered = await getAllRequests(carolCell);
      assert.lengthOf(carolRecovered, 1);

      const carolLatest = await getLatestRequest(
        carolCell,
        aliceRecord.signed_action.hashed.hash
      );
      assert.equal(carolLatest.title, "Updated during partition");
    }
  );
});
```

## Zome Testing Patterns

### CRUD Operations Testing

#### Create Operation Testing
```typescript
// tests/src/requests_and_offers/service-types-tests/create.test.ts
import { assert, expect, test } from "vitest";
import { Scenario, Player, dhtSync, PlayerApp } from "@holochain/tryorama";
import { runScenarioWithTwoAgents } from "../../utils";
import { sampleServiceType, createServiceType, getServiceType } from "../common";

test("create service type with validation", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario, alice, bob) => {
      const aliceCell = alice.namedCells.get("requests_and_offers")!;
      const bobCell = bob.namedCells.get("requests_and_offers")!;

      // Test 1: Valid service type creation
      const validServiceType = sampleServiceType({
        name: "Valid Service Type",
        description: "A valid service type with all required fields"
      });

      const validRecord = await createServiceType(aliceCell, validServiceType);
      assert.ok(validRecord);
      assert.ok(validRecord.signed_action.hashed.hash);

      // Test 2: Invalid service type (empty name)
      const invalidServiceType = sampleServiceType({ name: "" });

      await expect(
        createServiceType(aliceCell, invalidServiceType)
      ).rejects.toThrow("Name cannot be empty");

      // Test 3: Service type with name too long
      const longNameServiceType = sampleServiceType({
        name: "A".repeat(101) // Assuming 100 character limit
      });

      await expect(
        createServiceType(aliceCell, longNameServiceType)
      ).rejects.toThrow("Name cannot exceed 100 characters");

      // Sync valid creation
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      // Verify Bob can retrieve the valid service type
      const retrievedServiceType = await getServiceType(
        bobCell,
        validRecord.signed_action.hashed.hash
      );
      assert.ok(retrievedServiceType);
      assert.equal(retrievedServiceType.entry.name, "Valid Service Type");
    }
  );
});
```

#### Read Operation Testing
```typescript
test("read service type operations", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario, alice, bob) => {
      const aliceCell = alice.namedCells.get("requests_and_offers")!;
      const bobCell = bob.namedCells.get("requests_and_offers")!;

      // Create service type
      const serviceType = sampleServiceType();
      const originalRecord = await createServiceType(aliceCell, serviceType);

      // Test 1: Get existing service type
      const retrievedRecord = await getServiceType(
        aliceCell,
        originalRecord.signed_action.hashed.hash
      );
      assert.ok(retrievedRecord);
      assert.deepEqual(retrievedRecord.entry, serviceType);

      // Test 2: Get non-existent service type
      const nonExistentHash = new Uint8Array(32).fill(1);
      const nonExistentRecord = await getServiceType(aliceCell, nonExistentHash);
      assert.equal(nonExistentRecord, null);

      // Test 3: Get latest version after updates
      const updatedServiceType = { ...serviceType, name: "Updated Service Type" };
      const updatedRecord = await updateServiceType(
        aliceCell,
        originalRecord.signed_action.hashed.hash,
        originalRecord.signed_action.hashed.hash,
        updatedServiceType
      );

      const latestRecord = await getLatestServiceType(
        aliceCell,
        originalRecord.signed_action.hashed.hash
      );
      assert.ok(latestRecord);
      assert.equal(latestRecord.entry.name, "Updated Service Type");

      // Verify timestamp handling
      const originalTimestamp = originalRecord.action().timestamp();
      const updatedTimestamp = updatedRecord.action().timestamp();
      expect(updatedTimestamp).toBeGreaterThan(originalTimestamp);

      // Sync and verify Bob sees latest version
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      const bobLatest = await getLatestServiceType(
        bobCell,
        originalRecord.signed_action.hashed.hash
      );
      assert.equal(bobLatest.entry.name, "Updated Service Type");
      assert.equal(bobLatest.action().timestamp(), updatedTimestamp);
    }
  );
});
```

### Link Testing Patterns

#### Link Creation and Query Testing
```typescript
test("service type link management", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario, alice, bob) => {
      const aliceCell = alice.namedCells.get("requests_and_offers")!;
      const bobCell = bob.namedCells.get("requests_and_offers")!;

      // Create service type and request
      const serviceType = sampleServiceType();
      const serviceRecord = await createServiceType(aliceCell, serviceType);

      const request = sampleRequest();
      const requestRecord = await createRequest(aliceCell, request);

      // Test 1: Create link from request to service type
      await linkRequestToServiceType(
        aliceCell,
        requestRecord.signed_action.hashed.hash,
        serviceRecord.signed_action.hashed.hash
      );

      // Test 2: Query requests for service type
      const linkedRequests = await getRequestsForServiceType(
        aliceCell,
        serviceRecord.signed_action.hashed.hash
      );
      assert.lengthOf(linkedRequests, 1);
      assert.equal(
        linkedRequests[0].signed_action.hashed.hash,
        requestRecord.signed_action.hashed.hash
      );

      // Test 3: Query service types for request (reverse link)
      const linkedServiceTypes = await getServiceTypesForRequest(
        aliceCell,
        requestRecord.signed_action.hashed.hash
      );
      assert.lengthOf(linkedServiceTypes, 1);
      assert.equal(
        linkedServiceTypes[0],
        serviceRecord.signed_action.hashed.hash
      );

      // Test 4: Link with metadata
      await linkRequestToServiceTypeWithMetadata(
        aliceCell,
        requestRecord.signed_action.hashed.hash,
        serviceRecord.signed_action.hashed.hash,
        { priority: "high", relevance_score: 0.9 }
      );

      // Sync and verify Bob sees links
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      const bobLinkedRequests = await getRequestsForServiceType(
        bobCell,
        serviceRecord.signed_action.hashed.hash
      );
      assert.lengthOf(bobLinkedRequests, 1);

      // Test 5: Remove link
      await unlinkRequestFromServiceType(
        aliceCell,
        requestRecord.signed_action.hashed.hash,
        serviceRecord.signed_action.hashed.hash
      );

      // Verify link removal
      const requestsAfterUnlink = await getRequestsForServiceType(
        aliceCell,
        serviceRecord.signed_action.hashed.hash
      );
      assert.lengthOf(requestsAfterUnlink, 0);

      // Sync and verify Bob sees link removal
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      const bobRequestsAfterUnlink = await getRequestsForServiceType(
        bobCell,
        serviceRecord.signed_action.hashed.hash
      );
      assert.lengthOf(bobRequestsAfterUnlink, 0);
    }
  );
});
```

## Validation Testing

### Input Validation Testing
```typescript
test("service type input validation", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario, alice, _bob) => {
      const aliceCell = alice.namedCells.get("requests_and_offers")!;

      // Test cases for invalid inputs
      const invalidCases = [
        {
          name: "",
          expectedError: "Name cannot be empty"
        },
        {
          name: "A".repeat(101),
          expectedError: "Name cannot exceed 100 characters"
        },
        {
          name: "Service Type",
          description: "A".repeat(1001),
          expectedError: "Description cannot exceed 1000 characters"
        },
        {
          name: null,
          expectedError: "Name is required"
        },
        {
          name: undefined,
          expectedError: "Name is required"
        }
      ];

      for (const testCase of invalidCases) {
        await expect(
          createServiceType(aliceCell, testCase as any)
        ).rejects.toThrow(testCase.expectedError);
      }

      // Test valid cases
      const validCases = [
        {
          name: "Valid Service",
          description: "Valid description"
        },
        {
          name: "Service",
          description: null // Optional field
        },
        {
          name: "A".repeat(100), // Exactly at limit
          description: "Service with maximum name length"
        }
      ];

      for (const validCase of validCases) {
        const record = await createServiceType(aliceCell, validCase);
        assert.ok(record);
      }
    }
  );
});
```

### Business Rule Validation Testing
```typescript
test("business rule validation", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario, alice, bob) => {
      const aliceCell = alice.namedCells.get("requests_and_offers")!;
      const bobCell = bob.namedCells.get("requests_and_offers")!;

      // Setup admin
      await setupNetworkAdministrator(aliceCell, alice.agentPubKey);

      // Test 1: Cannot delete approved service type with active requests
      const serviceType = sampleServiceType();
      const serviceRecord = await createServiceType(aliceCell, serviceType);

      // Approve service type
      await approveServiceType(aliceCell, serviceRecord.signed_action.hashed.hash);

      // Create request linked to service type
      const request = sampleRequest();
      const requestRecord = await createRequest(
        aliceCell,
        request,
        undefined,
        [serviceRecord.signed_action.hashed.hash]
      );

      // Try to delete service type (should fail)
      await expect(
        deleteServiceType(aliceCell, serviceRecord.signed_action.hashed.hash)
      ).rejects.toThrow("Cannot delete service type with active requests");

      // Delete request first
      await deleteRequest(aliceCell, requestRecord.signed_action.hashed.hash);

      // Now can delete service type
      const deleteResult = await deleteServiceType(
        aliceCell,
        serviceRecord.signed_action.hashed.hash
      );
      assert.ok(deleteResult);

      // Test 2: Cannot change name of approved service type
      const anotherServiceType = sampleServiceType();
      const anotherRecord = await createServiceType(aliceCell, anotherServiceType);

      await approveServiceType(aliceCell, anotherRecord.signed_action.hashed.hash);

      // Try to change name (should fail)
      await expect(
        updateServiceType(
          aliceCell,
          anotherRecord.signed_action.hashed.hash,
          anotherRecord.signed_action.hashed.hash,
          { ...anotherServiceType, name: "Changed Name" }
        )
      ).rejects.toThrow("Cannot change name of approved service type");

      // But can change description
      const updateResult = await updateServiceType(
        aliceCell,
        anotherRecord.signed_action.hashed.hash,
        anotherRecord.signed_action.hashed.hash,
        { ...anotherServiceType, description: "Changed description" }
      );
      assert.ok(updateResult);
    }
  );
});
```

## Error Handling Testing

### Error Recovery Testing
```typescript
test("error handling and recovery", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario, alice, bob) => {
      const aliceCell = alice.namedCells.get("requests_and_offers")!;
      const bobCell = bob.namedCells.get("requests_and_offers")!;

      // Test 1: Handle non-existent record gracefully
      const nonExistentHash = new Uint8Array(32).fill(1);

      const nonExistentRecord = await getServiceType(aliceCell, nonExistentHash);
      assert.equal(nonExistentRecord, null); // Should return null, not throw

      // Test 2: Handle malformed input gracefully
      await expect(
        createServiceType(aliceCell, null as any)
      ).rejects.toThrow();

      await expect(
        createServiceType(aliceCell, undefined as any)
      ).rejects.toThrow();

      // Test 3: Concurrent operation conflict handling
      const serviceType = sampleServiceType();
      const record = await createServiceType(aliceCell, serviceType);

      // Simulate concurrent update
      const updatePromise1 = updateServiceType(
        aliceCell,
        record.signed_action.hashed.hash,
        record.signed_action.hashed.hash,
        { ...serviceType, name: "Update 1" }
      );

      const updatePromise2 = updateServiceType(
        aliceCell,
        record.signed_action.hashed.hash,
        record.signed_action.hashed.hash,
        { ...serviceType, name: "Update 2" }
      );

      // One should succeed, one should fail with conflict error
      const results = await Promise.allSettled([updatePromise1, updatePromise2]);

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // Verify final state is consistent
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      const finalRecord = await getLatestServiceType(
        bobCell,
        record.signed_action.hashed.hash
      );
      assert.ok(finalRecord);
      assert(finalRecord.entry.name === "Update 1" || finalRecord.entry.name === "Update 2");
    }
  );
});
```

## Performance Testing

### Large Dataset Testing
```typescript
test("performance with large datasets", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario, alice, bob) => {
      const aliceCell = alice.namedCells.get("requests_and_offers")!;
      const bobCell = bob.namedCells.get("requests_and_offers")!;

      // Create large number of records
      const recordCount = 100;
      const serviceTypes = Array.from({ length: recordCount }, (_, i) =>
        sampleServiceType({ name: `Service Type ${i}` })
      );

      console.time(`Creating ${recordCount} service types`);
      const records = await Promise.all(
        serviceTypes.map(serviceType => createServiceType(aliceCell, serviceType))
      );
      console.timeEnd(`Creating ${recordCount} service types`);

      expect(records).toHaveLength(recordCount);

      // Sync performance test
      console.time(`Syncing ${recordCount} records`);
      await dhtSync([alice, bob], aliceCell.cell_id[0]);
      console.timeEnd(`Syncing ${recordCount} records`);

      // Query performance test
      console.time(`Querying ${recordCount} records`);
      const allServiceTypes = await getAllServiceTypes(aliceCell);
      console.timeEnd(`Querying ${recordCount} records`);

      expect(allServiceTypes.approved.length + allServiceTypes.pending.length + allServiceTypes.rejected.length)
        .toBe(recordCount);

      // Batch operations performance test
      console.time(`Batch status updates`);
      await Promise.all(
        records.slice(0, 50).map(record =>
          approveServiceType(aliceCell, record.signed_action.hashed.hash)
        )
      );
      console.timeEnd(`Batch status updates`);

      // Verify performance with queries
      console.time(`Complex queries after batch updates`);
      const approvedServiceTypes = await getApprovedServiceTypes(bobCell);
      console.timeEnd(`Complex queries after batch updates`);

      expect(approvedServiceTypes.length).toBe(50);
    }
  );
});
```

## Test Data Management

### Test Data Factories
```typescript
// tests/src/factories.ts
export const sampleUser = (overrides = {}) => ({
  name: "Test User",
  avatar_url: "https://example.com/avatar.png",
  ...overrides
});

export const sampleOrganization = (overrides = {}) => ({
  name: "Test Organization",
  description: "A test organization",
  ...overrides
});

export const sampleServiceType = (overrides = {}) => ({
  name: "Test Service Type",
  description: "A test service type for testing",
  technical: false,
  ...overrides
});

export const sampleRequest = (overrides = {}) => ({
  title: "Test Request",
  description: "A test request for testing purposes",
  contact_preference: "Email",
  time_preference: "Morning",
  time_zone: "UTC",
  interaction_type: "Virtual",
  links: [],
  service_type_hashes: [],
  medium_of_exchange_hashes: [],
  ...overrides
});

export const sampleOffer = (overrides = {}) => ({
  title: "Test Offer",
  description: "A test offer for testing purposes",
  time_preference: "Afternoon",
  time_zone: "UTC",
  interaction_type: "In-Person",
  links: [],
  service_type_hashes: [],
  medium_of_exchange_hashes: [],
  ...overrides
});
```

### Test Utilities
```typescript
// tests/src/utils.ts
export const createMockHash = (prefix = "test"): Uint8Array => {
  const str = prefix.padEnd(32, '0');
  return new Uint8Array(Buffer.from(str, 'utf8').subarray(0, 32));
};

export const expectEqualHashes = (hash1: Uint8Array, hash2: Uint8Array) => {
  expect(hash1.length).toBe(hash2.length);
  for (let i = 0; i < hash1.length; i++) {
    expect(hash1[i]).toBe(hash2[i]);
  }
};

export const setupNetworkAdministrator = async (cell: any, agentPubKey: any) => {
  // Create user and register as admin
  const user = sampleUser({ name: "Admin" });
  const userRecord = await createUser(cell, user);

  await registerNetworkAdministrator(
    cell,
    userRecord.signed_action.hashed.hash,
    [agentPubKey]
  );

  return userRecord;
};

export const acceptUsers = async (cell: any, userRecords: any[]) => {
  for (const userRecord of userRecords) {
    const statusLink = await getUserStatusLink(cell, userRecord.signed_action.hashed.hash);
    const latestStatus = await getLatestStatusRecordForEntity(
      cell,
      "users",
      userRecord.signed_action.hashed.hash
    );

    await updateEntityStatus(
      cell,
      "users",
      userRecord.signed_action.hashed.hash,
      latestStatus.signed_action.hashed.hash,
      statusLink.target,
      { status_type: "accepted" }
    );
  }
};
```

## Best Practices

### Test Organization
- **Descriptive Test Names**: Use clear, descriptive names that explain the scenario
- **Logical Grouping**: Group related tests in describe blocks
- **Setup/Teardown**: Use beforeEach/afterEach for consistent test isolation
- **Test Data Management**: Use factories for consistent test data creation

### Multi-Agent Testing
- **Realistic Scenarios**: Test realistic user interaction patterns
- **Consistency Verification**: Always verify data consistency across agents
- **Sync Strategy**: Use appropriate sync points to ensure data propagation
- **Permission Testing**: Thoroughly test permission boundaries and enforcement

### Error Handling
- **Graceful Degradation**: Test that the system handles errors gracefully
- **Recovery Testing**: Test error recovery and system resilience
- **Edge Cases**: Test boundary conditions and unusual scenarios
- **Validation Testing**: Test input validation and business rule enforcement

### Performance Considerations
- **Large Datasets**: Test performance with realistic data volumes
- **Concurrent Operations**: Test system behavior under concurrent load
- **Network Latency**: Test with realistic network conditions
- **Resource Usage**: Monitor memory and CPU usage during tests

This comprehensive backend testing approach ensures robust, reliable Holochain applications with proper validation, permission enforcement, and data consistency across the peer-to-peer network.