import { assert, expect, test } from "vitest";
import { Scenario, Player, dhtSync, PlayerApp } from "@holochain/tryorama";

import { runScenarioWithTwoAgents } from "../utils";
import { createUser, getAgentUser, sampleUser } from "../users/common";
import {
  createOrganization,
  sampleOrganization,
} from "../organizations/common";
import {
  createServiceType,
  sampleServiceType,
} from "../service-types-tests/common";
import { createRequest, sampleRequest } from "../requests-tests/common";
import { createOffer, sampleOffer } from "../offers-tests/common";
import { registerNetworkAdministrator } from "../administration/common";
import {
  createExchangeResponse,
  deleteExchangeResponse,
  getAllResponses,
  getExchangeResponse,
  getMyResponses,
  getResponsesByAgent,
  getResponsesByStatus,
  getResponsesForEntity,
  getResponsesReceivedByMe,
  getResponseLatestStatus,
  getResponseStatusHistory,
  getTargetEntityForResponse,
  sampleExchangeResponse,
  updateResponseStatus,
  ExchangeResponseStatus,
} from "./common";

// Test for basic exchange response operations (create, read, update, delete)
test("basic exchange response operations", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Create users for Alice and Bob
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
      assert.ok(aliceUserRecord);

      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bob.cells[0], bobUser);
      assert.ok(bobUserRecord);

      // Create a service type
      const serviceType = await createServiceType(alice.cells[0], {
        service_type: sampleServiceType(),
      });
      assert.ok(serviceType);

      // Create an organization
      const organization = sampleOrganization({ name: "Test Org" });
      const orgRecord = await createOrganization(alice.cells[0], organization);
      assert.ok(orgRecord);

      // Sync once after creating users and initial data
      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Create a request without organization
      const request = sampleRequest();
      const requestRecord = await createRequest(
        alice.cells[0],
        request,
        undefined,
        [serviceType.signed_action.hashed.hash],
      );
      assert.ok(requestRecord);

      // Create a request with organization
      const requestWithOrg = sampleRequest({ title: "Org Request" });
      const requestWithOrgRecord = await createRequest(
        alice.cells[0],
        requestWithOrg,
        orgRecord.signed_action.hashed.hash,
        [serviceType.signed_action.hashed.hash],
      );
      assert.ok(requestWithOrgRecord);

      // Create an offer
      const offer = sampleOffer();
      const offerRecord = await createOffer(alice.cells[0], offer);
      assert.ok(offerRecord);

      // Sync after creating all the initial data
      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob creates responses to both request and offer
      const responseToRequest = sampleExchangeResponse(
        { service_details: "Response to request" },
        requestRecord.signed_action.hashed.hash,
      );
      const requestResponseRecord = await createExchangeResponse(
        bob.cells[0],
        responseToRequest,
      );
      assert.ok(requestResponseRecord);

      const responseToOffer = sampleExchangeResponse(
        { service_details: "Response to offer" },
        offerRecord.signed_action.hashed.hash,
      );
      const offerResponseRecord = await createExchangeResponse(
        bob.cells[0],
        responseToOffer,
      );
      assert.ok(offerResponseRecord);

      // Sync after creating responses
      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Get exchange response
      const fetchedResponse = await getExchangeResponse(
        alice.cells[0],
        requestResponseRecord.signed_action.hashed.hash,
      );
      assert.ok(fetchedResponse);

      // Update response status
      const statusUpdate = await updateResponseStatus(alice.cells[0], {
        response_hash: requestResponseRecord.signed_action.hashed.hash,
        new_status: ExchangeResponseStatus.Approved,
        reason: "Good proposal",
      });
      assert.ok(statusUpdate);

      // Sync after status update
      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Verify status was updated
      const latestStatus = await getResponseLatestStatus(
        bob.cells[0],
        requestResponseRecord.signed_action.hashed.hash,
      );
      assert.ok(latestStatus);

      // Get responses for entity
      const requestResponses = await getResponsesForEntity(
        alice.cells[0],
        requestRecord.signed_action.hashed.hash,
      );
      assert.lengthOf(requestResponses, 1);

      const offerResponses = await getResponsesForEntity(
        alice.cells[0],
        offerRecord.signed_action.hashed.hash,
      );
      assert.lengthOf(offerResponses, 1);

      // Get all responses
      const allResponses = await getAllResponses(alice.cells[0]);
      assert.lengthOf(allResponses, 2);

      // Get Bob's responses
      const bobResponses = await getResponsesByAgent(
        alice.cells[0],
        bob.agentPubKey,
      );
      assert.lengthOf(bobResponses, 2);

      // Get responses by status
      const approvedResponses = await getResponsesByStatus(
        alice.cells[0],
        ExchangeResponseStatus.Approved,
      );
      assert.lengthOf(approvedResponses, 1);

      const pendingResponses = await getResponsesByStatus(
        alice.cells[0],
        ExchangeResponseStatus.Pending,
      );
      assert.lengthOf(pendingResponses, 1);

      // Get my responses (Bob's perspective)
      const myResponses = await getMyResponses(bob.cells[0]);
      assert.lengthOf(myResponses, 2);

      // Get responses received by me (Alice's perspective)
      const receivedResponses = await getResponsesReceivedByMe(alice.cells[0]);
      assert.lengthOf(receivedResponses, 2);

      // Get target entity for response
      const targetEntity = await getTargetEntityForResponse(
        alice.cells[0],
        requestResponseRecord.signed_action.hashed.hash,
      );
      assert.ok(targetEntity);
      assert.deepEqual(targetEntity, requestRecord.signed_action.hashed.hash);

      // Get status history
      const statusHistory = await getResponseStatusHistory(
        alice.cells[0],
        requestResponseRecord.signed_action.hashed.hash,
      );
      assert.ok(statusHistory.length >= 1); // At least the approved status

      // Delete response (only allowed by creator)
      const deleteResult = await deleteExchangeResponse(
        bob.cells[0],
        offerResponseRecord.signed_action.hashed.hash,
      );
      assert.ok(deleteResult);

      // Final sync after delete
      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Verify response was deleted
      const allResponsesAfterDelete = await getAllResponses(alice.cells[0]);
      assert.lengthOf(allResponsesAfterDelete, 1);
    },
  );
});

// Test for duplicate response prevention
test("exchange response duplicate prevention", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Set up users first
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
      assert.ok(aliceUserRecord);

      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bob.cells[0], bobUser);
      assert.ok(bobUserRecord);

      // Create a service type
      const serviceType = await createServiceType(alice.cells[0], {
        service_type: sampleServiceType(),
      });
      assert.ok(serviceType);

      // Sync after initial setup
      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Alice creates a request
      const request = sampleRequest();
      const requestRecord = await createRequest(
        alice.cells[0],
        request,
        undefined,
        [serviceType.signed_action.hashed.hash],
      );
      const requestHash = requestRecord.signed_action.hashed.hash;
      assert.ok(requestRecord);

      // Sync after request creation
      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob creates first response to Alice's request
      const responseInput = sampleExchangeResponse({}, requestHash);
      const firstResponse = await createExchangeResponse(
        bob.cells[0],
        responseInput,
      );
      assert.ok(firstResponse);

      // Bob tries to create a second response to the same request (should fail)
      await expect(
        createExchangeResponse(bob.cells[0], responseInput),
      ).rejects.toThrow(/already have a pending response/);

      // Alice approves the first response
      await updateResponseStatus(alice.cells[0], {
        response_hash: firstResponse.signed_action.hashed.hash,
        new_status: ExchangeResponseStatus.Approved,
        reason: "Good proposal",
      });

      // Sync after status update
      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Now Bob should be able to create another response (since the previous one is no longer pending)
      const newResponseInput = sampleExchangeResponse(
        { service_details: "Updated service proposal" },
        requestHash,
      );
      const thirdResponse = await createExchangeResponse(
        bob.cells[0],
        newResponseInput,
      );
      assert.ok(thirdResponse);

      // Sync after final response
      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Verify all responses exist
      const allResponses = await getResponsesForEntity(
        alice.cells[0],
        requestHash,
      );
      assert.lengthOf(allResponses, 2);
    },
  );
});

// Test for administrator operations on exchange responses
test("administrator exchange response operations", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Create users for Alice and Bob
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
      assert.ok(aliceUserRecord);

      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bob.cells[0], bobUser);
      assert.ok(bobUserRecord);

      // Create a service type
      const serviceType = await createServiceType(alice.cells[0], {
        service_type: sampleServiceType(),
      });
      assert.ok(serviceType);

      // Create a request
      const request = sampleRequest();
      const requestRecord = await createRequest(
        alice.cells[0],
        request,
        undefined,
        [serviceType.signed_action.hashed.hash],
      );
      assert.ok(requestRecord);

      // Sync after initial setup
      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob creates a response
      const responseInput = sampleExchangeResponse(
        {},
        requestRecord.signed_action.hashed.hash,
      );
      const responseRecord = await createExchangeResponse(
        bob.cells[0],
        responseInput,
      );
      assert.ok(responseRecord);

      // Sync after response creation
      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Get Alice's user hash for making her an administrator
      const aliceUserHash = (
        await getAgentUser(alice.cells[0], alice.agentPubKey)
      )[0].target;

      // Make Alice an administrator
      const addAdminResult = await registerNetworkAdministrator(
        alice.cells[0],
        aliceUserHash,
        [alice.agentPubKey],
      );
      assert.ok(addAdminResult);

      // Sync after making Alice an administrator
      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Verify that Alice (as an administrator) can update response status
      const adminStatusUpdate = await updateResponseStatus(alice.cells[0], {
        response_hash: responseRecord.signed_action.hashed.hash,
        new_status: ExchangeResponseStatus.Rejected,
        reason: "Administrative rejection",
      });
      assert.ok(adminStatusUpdate);

      // Sync after admin status update
      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Verify the status was updated by the administrator
      const latestStatus = await getResponseLatestStatus(
        bob.cells[0],
        responseRecord.signed_action.hashed.hash,
      );
      assert.ok(latestStatus);

      // Verify admin can see all responses
      const allResponses = await getAllResponses(alice.cells[0]);
      assert.lengthOf(allResponses, 1);
    },
  );
});
