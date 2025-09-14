import { assert, expect, test } from "vitest";
import { Scenario, Player, dhtSync, PlayerApp } from "@holochain/tryorama";

import { runScenarioWithTwoAgents } from "../utils";
import { createUser, getAgentUser, sampleUser } from "../users/common";
import {
  createOrganization,
  sampleOrganization,
} from "../organizations/common";
import {
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

// Test for basic request operations (create, read, update, delete)
test("basic request operations", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Access the requests_and_offers DNA cells by role name
      const aliceRequestsAndOffers = alice.namedCells.get(
        "requests_and_offers",
      )!;
      const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

      // Create users for Alice and Bob
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(
        aliceRequestsAndOffers,
        aliceUser,
      );
      assert.ok(aliceUserRecord);

      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bobRequestsAndOffers, bobUser);
      assert.ok(bobUserRecord);

      // Sync once after creating users
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Create a request without organization
      const request = sampleRequest();
      const requestRecord = await createRequest(
        aliceRequestsAndOffers,
        request,
      );
      assert.ok(requestRecord);

      // Create a request with organization
      const organization = sampleOrganization({ name: "Test Org" });
      const orgRecord = await createOrganization(
        aliceRequestsAndOffers,
        organization,
      );
      assert.ok(orgRecord);

      const requestWithOrg = sampleRequest({ title: "Org Request" });
      const requestWithOrgRecord = await createRequest(
        aliceRequestsAndOffers,
        requestWithOrg,
        orgRecord.signed_action.hashed.hash,
      );
      assert.ok(requestWithOrgRecord);

      // Sync after creating all the initial data
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Get latest request
      const latestRequest = await getLatestRequest(
        aliceRequestsAndOffers,
        requestRecord.signed_action.hashed.hash,
      );
      // Handle null vs undefined for optional date_range field
      assert.deepEqual(latestRequest, { ...request, date_range: null });

      // Update request
      const updatedRequest = {
        ...request,
        title: "Updated Title",
      };
      const updatedRecord = await updateRequest(
        aliceRequestsAndOffers,
        requestRecord.signed_action.hashed.hash,
        requestRecord.signed_action.hashed.hash,
        updatedRequest,
      );
      assert.ok(updatedRecord);

      // Sync after update
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify that the request was updated
      const updatedRequestData = await getLatestRequest(
        aliceRequestsAndOffers,
        requestRecord.signed_action.hashed.hash,
      );
      assert.ok(updatedRequestData);
      assert.equal(updatedRequestData.title, "Updated Title");

      // Batch read operations
      const aliceUserHash = (
        await getAgentUser(aliceRequestsAndOffers, alice.agentPubKey)
      )[0].target;

      // Get all requests
      const allRequests = await getAllRequests(aliceRequestsAndOffers);
      assert.lengthOf(allRequests, 2);

      // Get user requests
      const userRequests = await getUserRequests(
        aliceRequestsAndOffers,
        aliceUserHash,
      );
      assert.lengthOf(userRequests, 2);

      // Get organization requests
      const orgRequests = await getOrganizationRequests(
        aliceRequestsAndOffers,
        orgRecord.signed_action.hashed.hash,
      );
      assert.lengthOf(orgRequests, 1);

      // Verify that Bob cannot update Alice's request
      await expect(
        updateRequest(
          bobRequestsAndOffers,
          requestRecord.signed_action.hashed.hash,
          requestRecord.signed_action.hashed.hash,
          { ...request, title: "Bob's update" },
        ),
      ).rejects.toThrow();

      // Verify that Bob cannot delete Alice's request
      await expect(
        deleteRequest(
          bobRequestsAndOffers,
          requestRecord.signed_action.hashed.hash,
        ),
      ).rejects.toThrow();

      // Delete a request
      const deleteResult = await deleteRequest(
        aliceRequestsAndOffers,
        requestWithOrgRecord.signed_action.hashed.hash,
      );
      assert.ok(deleteResult);

      // Final sync after delete
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify the request was deleted
      const allRequestsAfterDelete = await getAllRequests(
        aliceRequestsAndOffers,
      );
      assert.lengthOf(allRequestsAfterDelete, 1);

      // Verify the request was removed from organization requests
      const orgRequestsAfterDelete = await getOrganizationRequests(
        aliceRequestsAndOffers,
        orgRecord.signed_action.hashed.hash,
      );
      assert.lengthOf(orgRequestsAfterDelete, 0);

      // Verify the request was removed from user requests
      const userRequestsAfterDelete = await getUserRequests(
        aliceRequestsAndOffers,
        aliceUserHash,
      );
      assert.lengthOf(userRequestsAfterDelete, 1);
    },
  );
});

// Test for administrator operations on requests
test("administrator request operations", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Access the requests_and_offers DNA cells by role name
      const aliceRequestsAndOffers = alice.namedCells.get(
        "requests_and_offers",
      )!;
      const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

      // Create users for Alice and Bob
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(
        aliceRequestsAndOffers,
        aliceUser,
      );
      assert.ok(aliceUserRecord);

      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bobRequestsAndOffers, bobUser);
      assert.ok(bobUserRecord);

      // Create a request for Bob
      const bobRequest = sampleRequest({ title: "Bob's Request" });
      const bobRequestRecord = await createRequest(
        bobRequestsAndOffers,
        bobRequest,
      );
      assert.ok(bobRequestRecord);

      // Create another request for Bob that we'll update later
      const bobRequest2 = sampleRequest({ title: "Bob's Second Request" });
      const bobRequest2Record = await createRequest(
        bobRequestsAndOffers,
        bobRequest2,
      );
      assert.ok(bobRequest2Record);

      // Sync after initial setup
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify that Alice cannot update Bob's request initially
      try {
        await updateRequest(
          aliceRequestsAndOffers,
          bobRequest2Record.signed_action.hashed.hash,
          bobRequest2Record.signed_action.hashed.hash,
          { ...bobRequest2, title: "Updated by Alice" },
        );
        assert.fail("Alice should not be able to update Bob's request");
      } catch (error) {
        // Expected error
      }

      // Verify that Alice cannot delete Bob's request initially
      try {
        await deleteRequest(
          aliceRequestsAndOffers,
          bobRequestRecord.signed_action.hashed.hash,
        );
        assert.fail("Alice should not be able to delete Bob's request");
      } catch (error) {
        // Expected error
      }

      // Get Alice's user hash for making her an administrator
      const aliceUserHash = (
        await getAgentUser(aliceRequestsAndOffers, alice.agentPubKey)
      )[0].target;

      // Make Alice an administrator
      const addAdminResult = await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserHash,
        [alice.agentPubKey],
      );
      assert.ok(addAdminResult);

      // Sync after making Alice an administrator
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify that Alice (as an administrator) can now update Bob's request
      const updatedRequest = {
        ...bobRequest2,
        title: "Updated by Admin Alice",
      };

      const adminUpdateRecord = await updateRequest(
        aliceRequestsAndOffers,
        bobRequest2Record.signed_action.hashed.hash,
        bobRequest2Record.signed_action.hashed.hash,
        updatedRequest,
      );
      assert.ok(adminUpdateRecord);

      // Sync after admin update to ensure changes are propagated
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify the request was updated by the administrator
      const updatedRequestData = await getLatestRequest(
        bobRequestsAndOffers,
        bobRequest2Record.signed_action.hashed.hash,
      );
      assert.ok(updatedRequestData, "Failed to retrieve the updated request");
      assert.equal(
        updatedRequestData.title,
        "Updated by Admin Alice",
        "Admin update to title was not applied",
      );

      // Also verify that Bob can see the updated request
      const bobViewOfUpdatedRequest = await getLatestRequest(
        bobRequestsAndOffers,
        bobRequest2Record.signed_action.hashed.hash,
      );
      assert.equal(
        bobViewOfUpdatedRequest.title,
        "Updated by Admin Alice",
        "Bob cannot see the admin update to title",
      );

      // Verify that Alice (as an administrator) can now delete Bob's request
      const adminDeleteRecord = await deleteRequest(
        aliceRequestsAndOffers,
        bobRequestRecord.signed_action.hashed.hash,
      );
      assert.ok(adminDeleteRecord);

      // Sync after admin delete to ensure changes are propagated
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify the request was deleted by the administrator
      const allRequestsAfterAdminDelete =
        await getAllRequests(bobRequestsAndOffers);
      assert.lengthOf(allRequestsAfterAdminDelete, 1); // Only the updated request remains
    },
  );
});
