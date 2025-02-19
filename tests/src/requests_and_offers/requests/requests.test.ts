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
  getAllRequests,
  getLatestRequest,
  getOrganizationRequests,
  getUserRequests,
  sampleRequest,
  updateRequest,
} from "./common";

test("create and manage Requests", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: Player, bob: Player) => {
      // Create users for Alice and Bob
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
      assert.ok(aliceUserRecord);

      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bob.cells[0], bobUser);
      assert.ok(bobUserRecord);

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Test 1: Create a request without organization
      const request = sampleRequest();
      const requestRecord = await createRequest(alice.cells[0], request);
      assert.ok(requestRecord);

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Test 2: Create a request with organization
      const organization = sampleOrganization({ name: "Test Org" });
      const orgRecord = await createOrganization(alice.cells[0], organization);
      assert.ok(orgRecord);

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      const requestWithOrg = sampleRequest({ title: "Org Request" });
      const requestWithOrgRecord = await createRequest(
        alice.cells[0],
        requestWithOrg,
        orgRecord.signed_action.hashed.hash
      );
      assert.ok(requestWithOrgRecord);

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Test 3: Get latest request
      const latestRequest = await getLatestRequest(
        alice.cells[0],
        requestRecord.signed_action.hashed.hash
      );
      assert.deepEqual(latestRequest, request);

      // Test 4: Update request
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

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Test 5: Get all requests
      const allRequests = await getAllRequests(alice.cells[0]);
      assert.lengthOf(allRequests, 2);

      // Test 6: Get user requests
      const aliceUserHash = (
        await getAgentUser(alice.cells[0], alice.agentPubKey)
      )[0].target;
      const userRequests = await getUserRequests(alice.cells[0], aliceUserHash);
      assert.lengthOf(userRequests, 2);

      // Test 7: Get organization requests
      const orgRequests = await getOrganizationRequests(
        alice.cells[0],
        orgRecord.signed_action.hashed.hash
      );
      assert.lengthOf(orgRequests, 1);

      // Test 8: Verify that Bob cannot update Alice's request
      await expect(
        updateRequest(
          bob.cells[0],
          requestRecord.signed_action.hashed.hash,
          requestRecord.signed_action.hashed.hash,
          { ...request, title: "Bob's update" }
        )
      ).rejects.toThrow();
    }
  );
});
