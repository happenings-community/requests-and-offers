import { assert, expect, test } from "vitest";
import { Scenario, Player, dhtSync, PlayerApp } from "@holochain/tryorama";
import { ActionHash, Record } from "@holochain/client";
import { decode } from "@msgpack/msgpack";

import { runScenarioWithTwoAgents } from "../utils";
import { createUser, sampleUser } from "../users/common";
import { registerNetworkAdministrator } from "../administration/common";
import {
  createRequest,
  sampleRequest,
  updateRequest,
  deleteRequest,
  getAllRequests,
} from "../requests-tests/common";
import {
  createOffer,
  sampleOffer,
  updateOffer,
  deleteOffer,
  getAllOffers,
} from "../offers-tests/common";
import {
  createServiceType,
  sampleServiceType,
  getAllServiceTypes,
  getRequestsForServiceType,
  getOffersForServiceType,
  getServiceTypesForEntity,
  ServiceType,
} from "./common";

// Test for Request-ServiceType integration
test("Request-ServiceType integration", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Access the requests_and_offers DNA cells by role name
      const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
      const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

      // Setup users and admin
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bobRequestsAndOffers, bobUser);

      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserRecord.signed_action.hashed.hash,
        [alice.agentPubKey],
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Create service types
      const webDevServiceType = await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceType({
          name: "Web Development",
          description: "Frontend and backend development",
          tags: ["javascript", "react", "nodejs"],
        }),
      });

      const designServiceType = await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceType({
          name: "Design Services",
          description: "UI/UX and graphic design",
          tags: ["design", "ui", "ux"],
        }),
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Test creating request with service types
      const request = sampleRequest({
        title: "Need a website built",
        description: "Looking for someone to build a modern website",
        requirements: ["responsive design", "modern framework"],
      });

      const requestRecord = await createRequest(
        bobRequestsAndOffers,
        request,
        undefined,
        [
          webDevServiceType.signed_action.hashed.hash,
          designServiceType.signed_action.hashed.hash,
        ],
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify request was created
      assert.ok(requestRecord);
      const allRequests = await getAllRequests(bobRequestsAndOffers);
      assert.lengthOf(allRequests, 1);

      // Verify bidirectional links were created
      const requestsForWebDev = await getRequestsForServiceType(
        aliceRequestsAndOffers,
        webDevServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(requestsForWebDev, 1);
      assert.equal(
        requestsForWebDev[0].signed_action.hashed.hash.toString(),
        requestRecord.signed_action.hashed.hash.toString(),
      );

      const requestsForDesign = await getRequestsForServiceType(
        aliceRequestsAndOffers,
        designServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(requestsForDesign, 1);

      // Verify reverse links
      const serviceTypesForRequest = await getServiceTypesForEntity(
        aliceRequestsAndOffers,
        {
          original_action_hash: requestRecord.signed_action.hashed.hash,
          entity: "request",
        },
      );
      assert.lengthOf(serviceTypesForRequest, 2);

      // Test updating request with different service types
      const updatedRequest = {
        ...request,
        title: "Updated: Need a website built",
        description: "Updated description",
      };

      const updatedRequestRecord = await updateRequest(
        bobRequestsAndOffers,
        requestRecord.signed_action.hashed.hash,
        requestRecord.signed_action.hashed.hash,
        updatedRequest,
        [webDevServiceType.signed_action.hashed.hash], // Remove design service type
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify update worked
      assert.ok(updatedRequestRecord);

      // Verify service type links were updated
      const requestsForWebDevAfterUpdate = await getRequestsForServiceType(
        aliceRequestsAndOffers,
        webDevServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(requestsForWebDevAfterUpdate, 1);

      const requestsForDesignAfterUpdate = await getRequestsForServiceType(
        aliceRequestsAndOffers,
        designServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(requestsForDesignAfterUpdate, 0); // Should be removed

      // Verify reverse links updated
      const serviceTypesAfterUpdate = await getServiceTypesForEntity(
        aliceRequestsAndOffers,
        {
          original_action_hash: requestRecord.signed_action.hashed.hash,
          entity: "request",
        },
      );
      assert.lengthOf(serviceTypesAfterUpdate, 1);

      // Test deleting request
      const deleteResult = await deleteRequest(
        bobRequestsAndOffers,
        requestRecord.signed_action.hashed.hash,
      );
      assert.isTrue(deleteResult);

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify all service type links were cleaned up
      const requestsForWebDevAfterDelete = await getRequestsForServiceType(
        aliceRequestsAndOffers,
        webDevServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(requestsForWebDevAfterDelete, 0);

      const allRequestsAfterDelete = await getAllRequests(bobRequestsAndOffers);
      assert.lengthOf(allRequestsAfterDelete, 0);
    },
  );
});

// Test for Offer-ServiceType integration
test("Offer-ServiceType integration", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Access the requests_and_offers DNA cells by role name
      const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
      const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

      // Setup users and admin
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bobRequestsAndOffers, bobUser);

      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserRecord.signed_action.hashed.hash,
        [alice.agentPubKey],
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Create service types
      const webDevServiceType = await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceType({
          name: "Web Development",
          description: "Frontend and backend development",
          tags: ["javascript", "react", "nodejs"],
        }),
      });

      const designServiceType = await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceType({
          name: "Design Services",
          description: "UI/UX and graphic design",
          tags: ["design", "ui", "ux"],
        }),
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Test creating offer with service types
      const offer = sampleOffer({
        title: "Professional Web Development Services",
        description: "I offer full-stack web development services",
        capabilities: ["React", "Node.js", "UI/UX Design"],
      });

      const offerRecord = await createOffer(bobRequestsAndOffers, offer, undefined, [
        webDevServiceType.signed_action.hashed.hash,
        designServiceType.signed_action.hashed.hash,
      ]);

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify offer was created
      assert.ok(offerRecord);
      const allOffers = await getAllOffers(bobRequestsAndOffers);
      assert.lengthOf(allOffers, 1);

      // Verify bidirectional links were created
      const offersForWebDev = await getOffersForServiceType(
        aliceRequestsAndOffers,
        webDevServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(offersForWebDev, 1);
      assert.equal(
        offersForWebDev[0].signed_action.hashed.hash.toString(),
        offerRecord.signed_action.hashed.hash.toString(),
      );

      const offersForDesign = await getOffersForServiceType(
        aliceRequestsAndOffers,
        designServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(offersForDesign, 1);

      // Verify reverse links
      const serviceTypesForOffer = await getServiceTypesForEntity(
        aliceRequestsAndOffers,
        {
          original_action_hash: offerRecord.signed_action.hashed.hash,
          entity: "offer",
        },
      );
      assert.lengthOf(serviceTypesForOffer, 2);

      // Test updating offer with different service types
      const updatedOffer = {
        ...offer,
        title: "Updated: Professional Web Development Services",
        description: "Updated description",
      };

      const updatedOfferRecord = await updateOffer(
        bobRequestsAndOffers,
        offerRecord.signed_action.hashed.hash,
        offerRecord.signed_action.hashed.hash,
        updatedOffer,
        [designServiceType.signed_action.hashed.hash], // Remove web dev, keep design
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify update worked
      assert.ok(updatedOfferRecord);

      // Verify service type links were updated
      const offersForWebDevAfterUpdate = await getOffersForServiceType(
        aliceRequestsAndOffers,
        webDevServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(offersForWebDevAfterUpdate, 0); // Should be removed

      const offersForDesignAfterUpdate = await getOffersForServiceType(
        aliceRequestsAndOffers,
        designServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(offersForDesignAfterUpdate, 1);

      // Verify reverse links updated
      const serviceTypesAfterUpdate = await getServiceTypesForEntity(
        aliceRequestsAndOffers,
        {
          original_action_hash: offerRecord.signed_action.hashed.hash,
          entity: "offer",
        },
      );
      assert.lengthOf(serviceTypesAfterUpdate, 1);

      // Test deleting offer
      const deleteResult = await deleteOffer(
        bobRequestsAndOffers,
        offerRecord.signed_action.hashed.hash,
      );
      assert.isTrue(deleteResult);

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify all service type links were cleaned up
      const offersForDesignAfterDelete = await getOffersForServiceType(
        aliceRequestsAndOffers,
        designServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(offersForDesignAfterDelete, 0);

      const allOffersAfterDelete = await getAllOffers(bobRequestsAndOffers);
      assert.lengthOf(allOffersAfterDelete, 0);
    },
  );
});

// Test for complex scenarios with multiple requests and offers
test("Complex ServiceType scenarios with multiple entities", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Access the requests_and_offers DNA cells by role name
      const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
      const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

      // Setup users and admin
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bobRequestsAndOffers, bobUser);

      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserRecord.signed_action.hashed.hash,
        [alice.agentPubKey],
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Create service types
      const webDevServiceType = await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceType({
          name: "Web Development",
          tags: ["javascript", "react"],
        }),
      });

      const designServiceType = await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceType({
          name: "Design Services",
          tags: ["design", "ui"],
        }),
      });

      const marketingServiceType = await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceType({
          name: "Marketing Services",
          tags: ["marketing", "seo"],
        }),
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Create multiple requests with different service type combinations
      const request1 = await createRequest(
        aliceRequestsAndOffers,
        sampleRequest({ title: "Need website" }),
        undefined,
        [
          webDevServiceType.signed_action.hashed.hash,
          designServiceType.signed_action.hashed.hash,
        ],
      );

      const request2 = await createRequest(
        bobRequestsAndOffers,
        sampleRequest({ title: "Need marketing help" }),
        undefined,
        [marketingServiceType.signed_action.hashed.hash],
      );

      const request3 = await createRequest(
        aliceRequestsAndOffers,
        sampleRequest({ title: "Need full service" }),
        undefined,
        [
          webDevServiceType.signed_action.hashed.hash,
          designServiceType.signed_action.hashed.hash,
          marketingServiceType.signed_action.hashed.hash,
        ],
      );

      // Create multiple offers with different service type combinations
      const offer1 = await createOffer(
        bobRequestsAndOffers,
        sampleOffer({ title: "Web development services" }),
        undefined,
        [webDevServiceType.signed_action.hashed.hash],
      );

      const offer2 = await createOffer(
        aliceRequestsAndOffers,
        sampleOffer({ title: "Design services" }),
        undefined,
        [designServiceType.signed_action.hashed.hash],
      );

      const offer3 = await createOffer(
        bobRequestsAndOffers,
        sampleOffer({ title: "Full stack services" }),
        undefined,
        [
          webDevServiceType.signed_action.hashed.hash,
          designServiceType.signed_action.hashed.hash,
        ],
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Test querying by service type
      const webDevRequests = await getRequestsForServiceType(
        aliceRequestsAndOffers,
        webDevServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(webDevRequests, 2); // request1 and request3

      const webDevOffers = await getOffersForServiceType(
        aliceRequestsAndOffers,
        webDevServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(webDevOffers, 2); // offer1 and offer3

      const designRequests = await getRequestsForServiceType(
        aliceRequestsAndOffers,
        designServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(designRequests, 2); // request1 and request3

      const designOffers = await getOffersForServiceType(
        aliceRequestsAndOffers,
        designServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(designOffers, 2); // offer2 and offer3

      const marketingRequests = await getRequestsForServiceType(
        aliceRequestsAndOffers,
        marketingServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(marketingRequests, 2); // request2 and request3

      const marketingOffers = await getOffersForServiceType(
        aliceRequestsAndOffers,
        marketingServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(marketingOffers, 0); // No offers for marketing

      // Test reverse queries
      const serviceTypesForRequest1 = await getServiceTypesForEntity(
        aliceRequestsAndOffers,
        {
          original_action_hash: request1.signed_action.hashed.hash,
          entity: "request",
        },
      );
      assert.lengthOf(serviceTypesForRequest1, 2);

      const serviceTypesForOffer3 = await getServiceTypesForEntity(
        aliceRequestsAndOffers,
        {
          original_action_hash: offer3.signed_action.hashed.hash,
          entity: "offer",
        },
      );
      assert.lengthOf(serviceTypesForOffer3, 2);

      // Verify all service types are still available
      const allServiceTypes = await getAllServiceTypes(aliceRequestsAndOffers);
      assert.lengthOf(allServiceTypes, 3);
    },
  );
});

// Test for ServiceType with empty service type arrays
test("Requests and Offers with empty service type arrays", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Access the requests_and_offers DNA cells by role name
      const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
      const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

      // Setup users
      const aliceUser = sampleUser({ name: "Alice" });
      await createUser(aliceRequestsAndOffers, aliceUser);
      const bobUser = sampleUser({ name: "Bob" });
      await createUser(bobRequestsAndOffers, bobUser);

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Test creating request with no service types
      const request = sampleRequest({
        title: "General request",
        description: "A request with no specific service types",
      });

      const requestRecord = await createRequest(
        aliceRequestsAndOffers,
        request,
        undefined,
        [], // Empty service types array
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify request was created
      assert.ok(requestRecord);

      // Verify no service type links
      const serviceTypesForRequest = await getServiceTypesForEntity(
        aliceRequestsAndOffers,
        {
          original_action_hash: requestRecord.signed_action.hashed.hash,
          entity: "request",
        },
      );
      assert.lengthOf(serviceTypesForRequest, 0);

      // Test creating offer with no service types
      const offer = sampleOffer({
        title: "General offer",
        description: "An offer with no specific service types",
      });

      const offerRecord = await createOffer(
        bobRequestsAndOffers,
        offer,
        undefined,
        [], // Empty service types array
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify offer was created
      assert.ok(offerRecord);

      // Verify no service type links
      const serviceTypesForOffer = await getServiceTypesForEntity(
        aliceRequestsAndOffers,
        {
          original_action_hash: offerRecord.signed_action.hashed.hash,
          entity: "offer",
        },
      );
      assert.lengthOf(serviceTypesForOffer, 0);
    },
  );
});
