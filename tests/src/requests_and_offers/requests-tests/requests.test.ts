import { assert, expect, test } from "vitest";
import { Scenario, Player, dhtSync } from "@holochain/tryorama";

import { runScenarioWithTwoAgents } from "../utils";
import { createUser, getAgentUser, sampleUser } from "../users/common";
import {
  createOrganization,
  sampleOrganization,
} from "../organizations/common";
import {
  RequestProcessState,
  createRequest,
  deleteRequest,
  getAllRequests,
  getLatestRequest,
  getOrganizationRequests,
  getUserRequests,
  sampleRequest,
  updateRequest,
} from "./common";
import { registerNetworkAdministrator } from "../administration/common";

// Helper function to perform multiple DHT syncs to ensure proper synchronization
async function thoroughSync(players: Player[], cellId: Uint8Array, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    await dhtSync(players, cellId);
    // Small delay between syncs
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Test for basic request operations (create, read, update, delete)
test(
  "basic request operations",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        // Create users for Alice and Bob
        const aliceUser = sampleUser({ name: "Alice" });
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        assert.ok(aliceUserRecord);

        const bobUser = sampleUser({ name: "Bob" });
        const bobUserRecord = await createUser(bob.cells[0], bobUser);
        assert.ok(bobUserRecord);

        // Sync once after creating users
        await thoroughSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create a request without organization
        const request = sampleRequest();
        const requestRecord = await createRequest(alice.cells[0], request);
        assert.ok(requestRecord);

        // Create a request with organization
        const organization = sampleOrganization({ name: "Test Org" });
        const orgRecord = await createOrganization(
          alice.cells[0],
          organization
        );
        assert.ok(orgRecord);

        const requestWithOrg = sampleRequest({ title: "Org Request" });
        const requestWithOrgRecord = await createRequest(
          alice.cells[0],
          requestWithOrg,
          orgRecord.signed_action.hashed.hash
        );
        assert.ok(requestWithOrgRecord);

        // Sync after creating all the initial data
        await thoroughSync([alice, bob], alice.cells[0].cell_id[0]);

        // Get latest request
        const latestRequest = await getLatestRequest(
          alice.cells[0],
          requestRecord.signed_action.hashed.hash
        );
        assert.deepEqual(latestRequest, request);

        // Update request
        const updatedRequest = {
          ...request,
          title: "Updated Title",
          process_state: RequestProcessState.InProgress,
        };
        const updatedRecord = await updateRequest(
          alice.cells[0],
          requestRecord.signed_action.hashed.hash,
          requestRecord.signed_action.hashed.hash,
          updatedRequest
        );
        assert.ok(updatedRecord);

        // Sync after update
        await thoroughSync([alice, bob], alice.cells[0].cell_id[0]);

        // Batch read operations
        const aliceUserHash = (
          await getAgentUser(alice.cells[0], alice.agentPubKey)
        )[0].target;

        // Get all requests
        const allRequests = await getAllRequests(alice.cells[0]);
        assert.lengthOf(allRequests, 2);

        // Get user requests
        const userRequests = await getUserRequests(
          alice.cells[0],
          aliceUserHash
        );
        assert.lengthOf(userRequests, 2);

        // Get organization requests
        const orgRequests = await getOrganizationRequests(
          alice.cells[0],
          orgRecord.signed_action.hashed.hash
        );
        assert.lengthOf(orgRequests, 1);

        // Verify that Bob cannot update Alice's request
        await expect(
          updateRequest(
            bob.cells[0],
            requestRecord.signed_action.hashed.hash,
            requestRecord.signed_action.hashed.hash,
            { ...request, title: "Bob's update" }
          )
        ).rejects.toThrow();

        // Verify that Bob cannot delete Alice's request
        await expect(
          deleteRequest(bob.cells[0], requestRecord.signed_action.hashed.hash)
        ).rejects.toThrow();

        // Delete a request
        const deleteResult = await deleteRequest(
          alice.cells[0],
          requestWithOrgRecord.signed_action.hashed.hash
        );
        assert.ok(deleteResult);

        // Final sync after delete
        await thoroughSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify the request was deleted
        const allRequestsAfterDelete = await getAllRequests(alice.cells[0]);
        assert.lengthOf(allRequestsAfterDelete, 1);

        // Verify the request was removed from organization requests
        const orgRequestsAfterDelete = await getOrganizationRequests(
          alice.cells[0],
          orgRecord.signed_action.hashed.hash
        );
        assert.lengthOf(orgRequestsAfterDelete, 0);

        // Verify the request was removed from user requests
        const userRequestsAfterDelete = await getUserRequests(
          alice.cells[0],
          aliceUserHash
        );
        assert.lengthOf(userRequestsAfterDelete, 1);
      }
    );
  },
  {
    timeout: 180000, // 3 minutes should be enough
  }
);

// Test for administrator operations on requests
test(
  "administrator request operations",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        // Create users for Alice and Bob
        const aliceUser = sampleUser({ name: "Alice" });
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        assert.ok(aliceUserRecord);

        const bobUser = sampleUser({ name: "Bob" });
        const bobUserRecord = await createUser(bob.cells[0], bobUser);
        assert.ok(bobUserRecord);

        // Create a request for Bob
        const bobRequest = sampleRequest({ title: "Bob's Request" });
        const bobRequestRecord = await createRequest(bob.cells[0], bobRequest);
        assert.ok(bobRequestRecord);

        // Create another request for Bob that we'll update later
        const bobRequest2 = sampleRequest({ title: "Bob's Second Request" });
        const bobRequest2Record = await createRequest(
          bob.cells[0],
          bobRequest2
        );
        assert.ok(bobRequest2Record);

        // Sync after initial setup
        await thoroughSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify that Alice cannot update Bob's request initially
        try {
          await updateRequest(
            alice.cells[0],
            bobRequest2Record.signed_action.hashed.hash,
            bobRequest2Record.signed_action.hashed.hash,
            { ...bobRequest2, title: "Updated by Alice" }
          );
          assert.fail("Alice should not be able to update Bob's request");
        } catch (error) {
          // Expected error
        }

        // Verify that Alice cannot delete Bob's request initially
        try {
          await deleteRequest(
            alice.cells[0],
            bobRequestRecord.signed_action.hashed.hash
          );
          assert.fail("Alice should not be able to delete Bob's request");
        } catch (error) {
          // Expected error
        }

        // Get Alice's user hash for making her an administrator
        const aliceUserHash = (
          await getAgentUser(alice.cells[0], alice.agentPubKey)
        )[0].target;

        // Make Alice an administrator
        const addAdminResult = await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserHash,
          [alice.agentPubKey]
        );
        assert.ok(addAdminResult);

        // Sync after making Alice an administrator
        await thoroughSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify that Alice (as an administrator) can now update Bob's request
        const updatedRequest = {
          ...bobRequest2,
          title: "Updated by Admin Alice",
          process_state: RequestProcessState.InProgress,
        };

        const adminUpdateRecord = await updateRequest(
          alice.cells[0],
          bobRequest2Record.signed_action.hashed.hash,
          bobRequest2Record.signed_action.hashed.hash,
          updatedRequest
        );
        assert.ok(adminUpdateRecord);

        // Sync after admin update to ensure changes are propagated
        await thoroughSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify the request was updated by the administrator
        const updatedRequestData = await getLatestRequest(
          bob.cells[0],
          bobRequest2Record.signed_action.hashed.hash
        );
        assert.ok(updatedRequestData, "Failed to retrieve the updated request");
        assert.equal(updatedRequestData.title, "Updated by Admin Alice", "Admin update to title was not applied");
        assert.equal(
          updatedRequestData.process_state,
          RequestProcessState.InProgress,
          "Admin update to process state was not applied"
        );

        // Also verify that Bob can see the updated request
        const bobViewOfUpdatedRequest = await getLatestRequest(
          bob.cells[0],
          bobRequest2Record.signed_action.hashed.hash
        );
        assert.equal(bobViewOfUpdatedRequest.title, "Updated by Admin Alice", "Bob cannot see the admin update to title");

        // Verify that Alice (as an administrator) can now delete Bob's request
        const adminDeleteRecord = await deleteRequest(
          alice.cells[0],
          bobRequestRecord.signed_action.hashed.hash
        );
        assert.ok(adminDeleteRecord);

        // Sync after admin delete to ensure changes are propagated
        await thoroughSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify the request was deleted by the administrator
        const allRequestsAfterAdminDelete = await getAllRequests(bob.cells[0]);
        assert.lengthOf(allRequestsAfterAdminDelete, 1); // Only the updated request remains
      }
    );
  },
  {
    timeout: 300000, // 5 minutes should be enough
  }
);
