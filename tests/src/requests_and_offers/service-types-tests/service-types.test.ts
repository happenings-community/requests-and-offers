import { assert, expect, test } from "vitest";
import { Scenario, Player, dhtSync, PlayerApp } from "@holochain/tryorama";
import { ActionHash, Record } from "@holochain/client";
import { decode } from "@msgpack/msgpack";
import { runScenarioWithTwoAgents } from "../utils";
import { createUser, sampleUser } from "../users/common";
import { registerNetworkAdministrator } from "../administration/common";
import {
  createServiceType,
  deleteServiceType,
  getAllServiceTypes,
  getServiceType,
  getLatestServiceTypeRecord,
  sampleServiceType,
  updateServiceType,
  ServiceType,
  ServiceTypeInput,
  linkToServiceType,
  unlinkFromServiceType,
  getRequestsForServiceType,
  getOffersForServiceType,
  getServiceTypesForEntity,
  updateServiceTypeLinks,
  deleteAllServiceTypeLinksForEntity,
} from "./common";

// Test for basic ServiceType CRUD operations
test("basic ServiceType CRUD operations", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Access the requests_and_offers DNA cells by role name
      const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
      const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

      // Create users for Alice and Bob
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
      assert.ok(aliceUserRecord);

      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bobRequestsAndOffers, bobUser);
      assert.ok(bobUserRecord);

      // Register Alice as network administrator
      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserRecord.signed_action.hashed.hash,
        [alice.agentPubKey],
      );

      // Sync after initial setup
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Test creating a service type (Alice as admin)
      const serviceType = sampleServiceType({
        name: "Web Development",
        description: "Frontend and backend web development services",
        tags: ["javascript", "react", "nodejs"],
      });

      const serviceTypeInput: ServiceTypeInput = {
        service_type: serviceType,
      };

      const serviceTypeRecord: Record = await createServiceType(
        aliceRequestsAndOffers,
        serviceTypeInput,
      );
      assert.ok(serviceTypeRecord);

      const decodedServiceType = decode(
        (serviceTypeRecord.entry as any).Present.entry,
      ) as ServiceType;
      assert.equal(decodedServiceType.name, "Web Development");
      assert.equal(
        decodedServiceType.description,
        "Frontend and backend web development services",
      );
      assert.deepEqual(decodedServiceType.tags, [
        "javascript",
        "react",
        "nodejs",
      ]);

      // Sync after creating service type
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Test getting all service types
      const allServiceTypes: Record[] = await getAllServiceTypes(
        aliceRequestsAndOffers,
      );
      assert.lengthOf(allServiceTypes, 1);
      const firstServiceType = decode(
        (allServiceTypes[0].entry as any).Present.entry,
      ) as ServiceType;
      assert.equal(firstServiceType.name, decodedServiceType.name);

      // Test getting a specific service type
      const retrievedServiceType: Record | null = await getServiceType(
        aliceRequestsAndOffers,
        serviceTypeRecord.signed_action.hashed.hash,
      );
      assert.ok(retrievedServiceType);
      const retrievedDecoded = decode(
        (retrievedServiceType.entry as any).Present.entry,
      ) as ServiceType;
      assert.deepEqual(retrievedDecoded, decodedServiceType);

      // Test updating service type
      const updatedServiceType = {
        ...serviceType,
        description: "Updated description for web development",
        tags: ["javascript", "react", "nodejs", "typescript"],
      };

      const updateResult = await updateServiceType(aliceRequestsAndOffers, {
        original_service_type_hash: serviceTypeRecord.signed_action.hashed.hash,
        previous_service_type_hash: serviceTypeRecord.signed_action.hashed.hash,
        updated_service_type: updatedServiceType,
      });
      assert.ok(updateResult);

      // Sync after update
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify the service type was updated
      const updatedRecord = await getLatestServiceTypeRecord(
        aliceRequestsAndOffers,
        serviceTypeRecord.signed_action.hashed.hash,
      );
      assert.ok(updatedRecord);
      const updatedDecoded = decode(
        (updatedRecord.entry as any).Present.entry,
      ) as ServiceType;
      assert.equal(
        updatedDecoded.description,
        "Updated description for web development",
      );
      assert.lengthOf(updatedDecoded.tags, 4);

      // Note: Authorization tests for Bob are in a separate test

      // Test deleting service type (Alice as admin)
      const deleteResult = await deleteServiceType(
        aliceRequestsAndOffers,
        serviceTypeRecord.signed_action.hashed.hash,
      );
      assert.ok(deleteResult);

      // Final sync after delete
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify the service type was deleted
      const allServiceTypesAfterDelete = await getAllServiceTypes(
        aliceRequestsAndOffers,
      );
      assert.lengthOf(allServiceTypesAfterDelete, 0);
    },
  );
});

// Test for ServiceType validation
test("ServiceType validation", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, _bob: PlayerApp) => {
      // Create user for Alice
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
      assert.ok(aliceUserRecord);

      // Register Alice as network administrator
      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserRecord.signed_action.hashed.hash,
        [alice.agentPubKey],
      );

      // Sync after setup
      await dhtSync([alice], aliceRequestsAndOffers.cell_id[0]);

      // Test validation - empty name should fail
      const invalidServiceTypeInput: ServiceTypeInput = {
        service_type: sampleServiceType({
          name: "",
          description: "Valid description",
        }),
      };

      await expect(
        createServiceType(aliceRequestsAndOffers, invalidServiceTypeInput),
      ).rejects.toThrow();

      // Test validation - empty description should fail
      const invalidServiceTypeInput2: ServiceTypeInput = {
        service_type: sampleServiceType({
          name: "Valid Name",
          description: "",
        }),
      };

      await expect(
        createServiceType(aliceRequestsAndOffers, invalidServiceTypeInput2),
      ).rejects.toThrow();
    },
  );
});

// Test for ServiceType admin permissions
test("ServiceType admin permissions", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Create users for Alice and Bob
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bobRequestsAndOffers, bobUser);

      // Sync after creating users
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Test that Bob (non-admin) cannot create service types
      const serviceTypeInput: ServiceTypeInput = {
        service_type: sampleServiceType({
          name: "Design Services",
          description: "UI/UX and graphic design services",
          tags: ["design", "ui", "ux"],
        }),
      };

      await expect(
        createServiceType(bobRequestsAndOffers, serviceTypeInput),
      ).rejects.toThrow();

      // Register Alice as network administrator
      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserRecord.signed_action.hashed.hash,
        [alice.agentPubKey],
      );

      // Sync after registering admin
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Test that Alice (admin) can create service types
      const serviceTypeRecord = await createServiceType(
        aliceRequestsAndOffers,
        serviceTypeInput,
      );
      assert.ok(serviceTypeRecord);

      // Sync after creating service type
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify the service type was created
      const allServiceTypes = await getAllServiceTypes(aliceRequestsAndOffers);
      assert.lengthOf(allServiceTypes, 1);
    },
  );
});

// Test for ServiceType linking functionality
test("ServiceType linking with requests and offers", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
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

      // Test manual linking
      const mockRequestHash = webDevServiceType.signed_action.hashed.hash; // Using as mock

      await linkToServiceType(aliceRequestsAndOffers, {
        service_type_hash: webDevServiceType.signed_action.hashed.hash,
        action_hash: mockRequestHash,
        entity: "request",
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Test getting requests for service type
      const requestsForWebDev = await getRequestsForServiceType(
        aliceRequestsAndOffers,
        webDevServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(requestsForWebDev, 1);

      // Test getting service types for entity
      const serviceTypesForRequest = await getServiceTypesForEntity(
        aliceRequestsAndOffers,
        {
          original_action_hash: mockRequestHash,
          entity: "request",
        },
      );
      assert.lengthOf(serviceTypesForRequest, 1);
      assert.equal(
        serviceTypesForRequest[0].toString(),
        webDevServiceType.signed_action.hashed.hash.toString(),
      );

      // Test unlinking
      await unlinkFromServiceType(aliceRequestsAndOffers, {
        service_type_hash: webDevServiceType.signed_action.hashed.hash,
        action_hash: mockRequestHash,
        entity: "request",
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify unlink worked
      const requestsAfterUnlink = await getRequestsForServiceType(
        aliceRequestsAndOffers,
        webDevServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(requestsAfterUnlink, 0);
    },
  );
});

// Test for ServiceType update links functionality
test("ServiceType update links management", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Setup users and admin
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
      const bobUser = sampleUser({ name: "Bob" });
      await createUser(bobRequestsAndOffers, bobUser);

      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserRecord.signed_action.hashed.hash,
        [alice.agentPubKey],
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Create multiple service types
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

      // Mock entity hash
      const mockEntityHash = webDevServiceType.signed_action.hashed.hash;

      // Test updating service type links - start with web dev and design
      const initialServiceTypes = [
        webDevServiceType.signed_action.hashed.hash,
        designServiceType.signed_action.hashed.hash,
      ];

      await updateServiceTypeLinks(aliceRequestsAndOffers, {
        action_hash: mockEntityHash,
        entity: "request",
        new_service_type_hashes: initialServiceTypes,
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify initial links
      let serviceTypesForEntity = await getServiceTypesForEntity(
        aliceRequestsAndOffers,
        {
          original_action_hash: mockEntityHash,
          entity: "request",
        },
      );
      assert.lengthOf(serviceTypesForEntity, 2);

      // Test updating links - remove design, add marketing
      const updatedServiceTypes = [
        webDevServiceType.signed_action.hashed.hash,
        marketingServiceType.signed_action.hashed.hash,
      ];

      await updateServiceTypeLinks(aliceRequestsAndOffers, {
        action_hash: mockEntityHash,
        entity: "request",
        new_service_type_hashes: updatedServiceTypes,
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify updated links
      serviceTypesForEntity = await getServiceTypesForEntity(aliceRequestsAndOffers, {
        original_action_hash: mockEntityHash,
        entity: "request",
      });
      assert.lengthOf(serviceTypesForEntity, 2);

      // Verify design service type no longer has links to this entity
      const requestsForDesign = await getRequestsForServiceType(
        aliceRequestsAndOffers,
        designServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(requestsForDesign, 0);

      // Verify marketing service type now has links
      const requestsForMarketing = await getRequestsForServiceType(
        aliceRequestsAndOffers,
        marketingServiceType.signed_action.hashed.hash,
      );
      assert.lengthOf(requestsForMarketing, 1);
    },
  );
});

// Test for ServiceType deletion with cleanup
test("ServiceType deletion and link cleanup", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Setup users and admin
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
      const bobUser = sampleUser({ name: "Bob" });
      await createUser(bobRequestsAndOffers, bobUser);

      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserRecord.signed_action.hashed.hash,
        [alice.agentPubKey],
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Create service type
      const serviceType = await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceType({
          name: "Test Service",
          description: "Test service for deletion",
        }),
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Create links to mock entities
      const mockRequestHash = serviceType.signed_action.hashed.hash;
      const mockOfferHash = serviceType.signed_action.hashed.hash;

      await linkToServiceType(aliceRequestsAndOffers, {
        service_type_hash: serviceType.signed_action.hashed.hash,
        action_hash: mockRequestHash,
        entity: "request",
      });

      await linkToServiceType(aliceRequestsAndOffers, {
        service_type_hash: serviceType.signed_action.hashed.hash,
        action_hash: mockOfferHash,
        entity: "offer",
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify links exist
      const requestsBeforeDelete = await getRequestsForServiceType(
        aliceRequestsAndOffers,
        serviceType.signed_action.hashed.hash,
      );
      const offersBeforeDelete = await getOffersForServiceType(
        aliceRequestsAndOffers,
        serviceType.signed_action.hashed.hash,
      );
      assert.lengthOf(requestsBeforeDelete, 1);
      assert.lengthOf(offersBeforeDelete, 1);

      // Test entity deletion cleanup
      await deleteAllServiceTypeLinksForEntity(aliceRequestsAndOffers, {
        original_action_hash: mockRequestHash,
        entity: "request",
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify request links are cleaned up
      const requestsAfterCleanup = await getRequestsForServiceType(
        aliceRequestsAndOffers,
        serviceType.signed_action.hashed.hash,
      );
      assert.lengthOf(requestsAfterCleanup, 0);

      // Verify offer links still exist
      const offersAfterCleanup = await getOffersForServiceType(
        aliceRequestsAndOffers,
        serviceType.signed_action.hashed.hash,
      );
      assert.lengthOf(offersAfterCleanup, 1);
    },
  );
});

// Test for ServiceType error handling
test("ServiceType error handling and edge cases", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Setup users and admin
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
      const bobUser = sampleUser({ name: "Bob" });
      await createUser(bobRequestsAndOffers, bobUser);

      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserRecord.signed_action.hashed.hash,
        [alice.agentPubKey],
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Create a real service type for testing
      const serviceType = await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceType({ name: "Test Service" }),
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Test linking with invalid entity type
      await expect(
        linkToServiceType(aliceRequestsAndOffers, {
          service_type_hash: serviceType.signed_action.hashed.hash,
          action_hash: serviceType.signed_action.hashed.hash,
          entity: "invalid_entity",
        }),
      ).rejects.toThrow();

      // Test getting service types for invalid entity
      await expect(
        getServiceTypesForEntity(aliceRequestsAndOffers, {
          original_action_hash: serviceType.signed_action.hashed.hash,
          entity: "invalid_entity",
        }),
      ).rejects.toThrow();

      // Test unauthorized operations (Bob trying admin functions)
      await expect(
        updateServiceType(bobRequestsAndOffers, {
          original_service_type_hash: serviceType.signed_action.hashed.hash,
          previous_service_type_hash: serviceType.signed_action.hashed.hash,
          updated_service_type: sampleServiceType({ name: "Updated" }),
        }),
      ).rejects.toThrow();

      await expect(
        deleteServiceType(bobRequestsAndOffers, serviceType.signed_action.hashed.hash),
      ).rejects.toThrow();

      // Test creating service type with Bob (non-admin) - should fail
      await expect(
        createServiceType(bobRequestsAndOffers, {
          service_type: sampleServiceType({ name: "Bob's Service" }),
        }),
      ).rejects.toThrow();
    },
  );
});
