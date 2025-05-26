import { assert, expect, test } from "vitest";
import { Scenario, Player, dhtSync } from "@holochain/tryorama";
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
test(
  "Request-ServiceType integration",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        // Setup users and admin
        const aliceUser = sampleUser({ name: "Alice" });
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        const bobUser = sampleUser({ name: "Bob" });
        const bobUserRecord = await createUser(bob.cells[0], bobUser);

        await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create service types
        const webDevServiceType = await createServiceType(alice.cells[0], {
          service_type: sampleServiceType({
            name: "Web Development",
            description: "Frontend and backend development",
            tags: ["javascript", "react", "nodejs"],
          }),
        });

        const designServiceType = await createServiceType(alice.cells[0], {
          service_type: sampleServiceType({
            name: "Design Services",
            description: "UI/UX and graphic design",
            tags: ["design", "ui", "ux"],
          }),
        });

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test creating request with service types
        const request = sampleRequest({
          title: "Need a website built",
          description: "Looking for someone to build a modern website",
          requirements: ["responsive design", "modern framework"],
        });

        const requestRecord = await createRequest(
          bob.cells[0],
          request,
          undefined,
          [
            webDevServiceType.signed_action.hashed.hash,
            designServiceType.signed_action.hashed.hash,
          ]
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify request was created
        assert.ok(requestRecord);
        const allRequests = await getAllRequests(bob.cells[0]);
        assert.lengthOf(allRequests, 1);

        // Verify bidirectional links were created
        const requestsForWebDev = await getRequestsForServiceType(
          alice.cells[0],
          webDevServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(requestsForWebDev, 1);
        assert.equal(
          requestsForWebDev[0].signed_action.hashed.hash.toString(),
          requestRecord.signed_action.hashed.hash.toString()
        );

        const requestsForDesign = await getRequestsForServiceType(
          alice.cells[0],
          designServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(requestsForDesign, 1);

        // Verify reverse links
        const serviceTypesForRequest = await getServiceTypesForEntity(
          alice.cells[0],
          {
            original_action_hash: requestRecord.signed_action.hashed.hash,
            entity: "request",
          }
        );
        assert.lengthOf(serviceTypesForRequest, 2);

        // Test updating request with different service types
        const updatedRequest = {
          ...request,
          title: "Updated: Need a website built",
          description: "Updated description",
        };

        const updatedRequestRecord = await updateRequest(
          bob.cells[0],
          requestRecord.signed_action.hashed.hash,
          requestRecord.signed_action.hashed.hash,
          updatedRequest,
          [webDevServiceType.signed_action.hashed.hash] // Remove design service type
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify update worked
        assert.ok(updatedRequestRecord);

        // Verify service type links were updated
        const requestsForWebDevAfterUpdate = await getRequestsForServiceType(
          alice.cells[0],
          webDevServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(requestsForWebDevAfterUpdate, 1);

        const requestsForDesignAfterUpdate = await getRequestsForServiceType(
          alice.cells[0],
          designServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(requestsForDesignAfterUpdate, 0); // Should be removed

        // Verify reverse links updated
        const serviceTypesAfterUpdate = await getServiceTypesForEntity(
          alice.cells[0],
          {
            original_action_hash: requestRecord.signed_action.hashed.hash,
            entity: "request",
          }
        );
        assert.lengthOf(serviceTypesAfterUpdate, 1);

        // Test deleting request
        const deleteResult = await deleteRequest(
          bob.cells[0],
          requestRecord.signed_action.hashed.hash
        );
        assert.isTrue(deleteResult);

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify all service type links were cleaned up
        const requestsForWebDevAfterDelete = await getRequestsForServiceType(
          alice.cells[0],
          webDevServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(requestsForWebDevAfterDelete, 0);

        const allRequestsAfterDelete = await getAllRequests(bob.cells[0]);
        assert.lengthOf(allRequestsAfterDelete, 0);
      }
    );
  },
  {
    timeout: 180000,
  }
);

// Test for Offer-ServiceType integration
test(
  "Offer-ServiceType integration",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        // Setup users and admin
        const aliceUser = sampleUser({ name: "Alice" });
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        const bobUser = sampleUser({ name: "Bob" });
        const bobUserRecord = await createUser(bob.cells[0], bobUser);

        await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create service types
        const webDevServiceType = await createServiceType(alice.cells[0], {
          service_type: sampleServiceType({
            name: "Web Development",
            description: "Frontend and backend development",
            tags: ["javascript", "react", "nodejs"],
          }),
        });

        const designServiceType = await createServiceType(alice.cells[0], {
          service_type: sampleServiceType({
            name: "Design Services",
            description: "UI/UX and graphic design",
            tags: ["design", "ui", "ux"],
          }),
        });

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test creating offer with service types
        const offer = sampleOffer({
          title: "Professional Web Development Services",
          description: "I offer full-stack web development services",
          capabilities: ["React", "Node.js", "UI/UX Design"],
        });

        const offerRecord = await createOffer(bob.cells[0], offer, undefined, [
          webDevServiceType.signed_action.hashed.hash,
          designServiceType.signed_action.hashed.hash,
        ]);

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify offer was created
        assert.ok(offerRecord);
        const allOffers = await getAllOffers(bob.cells[0]);
        assert.lengthOf(allOffers, 1);

        // Verify bidirectional links were created
        const offersForWebDev = await getOffersForServiceType(
          alice.cells[0],
          webDevServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(offersForWebDev, 1);
        assert.equal(
          offersForWebDev[0].signed_action.hashed.hash.toString(),
          offerRecord.signed_action.hashed.hash.toString()
        );

        const offersForDesign = await getOffersForServiceType(
          alice.cells[0],
          designServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(offersForDesign, 1);

        // Verify reverse links
        const serviceTypesForOffer = await getServiceTypesForEntity(
          alice.cells[0],
          {
            original_action_hash: offerRecord.signed_action.hashed.hash,
            entity: "offer",
          }
        );
        assert.lengthOf(serviceTypesForOffer, 2);

        // Test updating offer with different service types
        const updatedOffer = {
          ...offer,
          title: "Updated: Professional Web Development Services",
          description: "Updated description",
        };

        const updatedOfferRecord = await updateOffer(
          bob.cells[0],
          offerRecord.signed_action.hashed.hash,
          offerRecord.signed_action.hashed.hash,
          updatedOffer,
          [designServiceType.signed_action.hashed.hash] // Remove web dev, keep design
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify update worked
        assert.ok(updatedOfferRecord);

        // Verify service type links were updated
        const offersForWebDevAfterUpdate = await getOffersForServiceType(
          alice.cells[0],
          webDevServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(offersForWebDevAfterUpdate, 0); // Should be removed

        const offersForDesignAfterUpdate = await getOffersForServiceType(
          alice.cells[0],
          designServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(offersForDesignAfterUpdate, 1);

        // Verify reverse links updated
        const serviceTypesAfterUpdate = await getServiceTypesForEntity(
          alice.cells[0],
          {
            original_action_hash: offerRecord.signed_action.hashed.hash,
            entity: "offer",
          }
        );
        assert.lengthOf(serviceTypesAfterUpdate, 1);

        // Test deleting offer
        const deleteResult = await deleteOffer(
          bob.cells[0],
          offerRecord.signed_action.hashed.hash
        );
        assert.isTrue(deleteResult);

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify all service type links were cleaned up
        const offersForDesignAfterDelete = await getOffersForServiceType(
          alice.cells[0],
          designServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(offersForDesignAfterDelete, 0);

        const allOffersAfterDelete = await getAllOffers(bob.cells[0]);
        assert.lengthOf(allOffersAfterDelete, 0);
      }
    );
  },
  {
    timeout: 180000,
  }
);

// Test for complex scenarios with multiple requests and offers
test(
  "Complex ServiceType scenarios with multiple entities",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        // Setup users and admin
        const aliceUser = sampleUser({ name: "Alice" });
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        const bobUser = sampleUser({ name: "Bob" });
        const bobUserRecord = await createUser(bob.cells[0], bobUser);

        await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create service types
        const webDevServiceType = await createServiceType(alice.cells[0], {
          service_type: sampleServiceType({
            name: "Web Development",
            tags: ["javascript", "react"],
          }),
        });

        const designServiceType = await createServiceType(alice.cells[0], {
          service_type: sampleServiceType({
            name: "Design Services",
            tags: ["design", "ui"],
          }),
        });

        const marketingServiceType = await createServiceType(alice.cells[0], {
          service_type: sampleServiceType({
            name: "Marketing Services",
            tags: ["marketing", "seo"],
          }),
        });

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create multiple requests with different service type combinations
        const request1 = await createRequest(
          alice.cells[0],
          sampleRequest({ title: "Need website" }),
          undefined,
          [
            webDevServiceType.signed_action.hashed.hash,
            designServiceType.signed_action.hashed.hash,
          ]
        );

        const request2 = await createRequest(
          bob.cells[0],
          sampleRequest({ title: "Need marketing help" }),
          undefined,
          [marketingServiceType.signed_action.hashed.hash]
        );

        const request3 = await createRequest(
          alice.cells[0],
          sampleRequest({ title: "Need full service" }),
          undefined,
          [
            webDevServiceType.signed_action.hashed.hash,
            designServiceType.signed_action.hashed.hash,
            marketingServiceType.signed_action.hashed.hash,
          ]
        );

        // Create multiple offers with different service type combinations
        const offer1 = await createOffer(
          bob.cells[0],
          sampleOffer({ title: "Web development services" }),
          undefined,
          [webDevServiceType.signed_action.hashed.hash]
        );

        const offer2 = await createOffer(
          alice.cells[0],
          sampleOffer({ title: "Design services" }),
          undefined,
          [designServiceType.signed_action.hashed.hash]
        );

        const offer3 = await createOffer(
          bob.cells[0],
          sampleOffer({ title: "Full stack services" }),
          undefined,
          [
            webDevServiceType.signed_action.hashed.hash,
            designServiceType.signed_action.hashed.hash,
          ]
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test querying by service type
        const webDevRequests = await getRequestsForServiceType(
          alice.cells[0],
          webDevServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(webDevRequests, 2); // request1 and request3

        const webDevOffers = await getOffersForServiceType(
          alice.cells[0],
          webDevServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(webDevOffers, 2); // offer1 and offer3

        const designRequests = await getRequestsForServiceType(
          alice.cells[0],
          designServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(designRequests, 2); // request1 and request3

        const designOffers = await getOffersForServiceType(
          alice.cells[0],
          designServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(designOffers, 2); // offer2 and offer3

        const marketingRequests = await getRequestsForServiceType(
          alice.cells[0],
          marketingServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(marketingRequests, 2); // request2 and request3

        const marketingOffers = await getOffersForServiceType(
          alice.cells[0],
          marketingServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(marketingOffers, 0); // No offers for marketing

        // Test reverse queries
        const serviceTypesForRequest1 = await getServiceTypesForEntity(
          alice.cells[0],
          {
            original_action_hash: request1.signed_action.hashed.hash,
            entity: "request",
          }
        );
        assert.lengthOf(serviceTypesForRequest1, 2);

        const serviceTypesForOffer3 = await getServiceTypesForEntity(
          alice.cells[0],
          {
            original_action_hash: offer3.signed_action.hashed.hash,
            entity: "offer",
          }
        );
        assert.lengthOf(serviceTypesForOffer3, 2);

        // Verify all service types are still available
        const allServiceTypes = await getAllServiceTypes(alice.cells[0]);
        assert.lengthOf(allServiceTypes, 3);
      }
    );
  },
  {
    timeout: 180000,
  }
);

// Test for ServiceType with empty service type arrays
test(
  "Requests and Offers with empty service type arrays",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        // Setup users
        const aliceUser = sampleUser({ name: "Alice" });
        await createUser(alice.cells[0], aliceUser);
        const bobUser = sampleUser({ name: "Bob" });
        await createUser(bob.cells[0], bobUser);

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test creating request with no service types
        const request = sampleRequest({
          title: "General request",
          description: "A request with no specific service types",
        });

        const requestRecord = await createRequest(
          alice.cells[0],
          request,
          undefined,
          [] // Empty service types array
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify request was created
        assert.ok(requestRecord);

        // Verify no service type links
        const serviceTypesForRequest = await getServiceTypesForEntity(
          alice.cells[0],
          {
            original_action_hash: requestRecord.signed_action.hashed.hash,
            entity: "request",
          }
        );
        assert.lengthOf(serviceTypesForRequest, 0);

        // Test creating offer with no service types
        const offer = sampleOffer({
          title: "General offer",
          description: "An offer with no specific service types",
        });

        const offerRecord = await createOffer(
          bob.cells[0],
          offer,
          undefined,
          [] // Empty service types array
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify offer was created
        assert.ok(offerRecord);

        // Verify no service type links
        const serviceTypesForOffer = await getServiceTypesForEntity(
          alice.cells[0],
          {
            original_action_hash: offerRecord.signed_action.hashed.hash,
            entity: "offer",
          }
        );
        assert.lengthOf(serviceTypesForOffer, 0);
      }
    );
  },
  {
    timeout: 180000,
  }
);
