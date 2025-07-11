import { assert, expect, test } from "vitest";
import { Scenario, Player, dhtSync } from "@holochain/tryorama";
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
test(
  "basic ServiceType CRUD operations",
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

        // Register Alice as network administrator
        await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );

        // Sync after initial setup
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

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
          alice.cells[0],
          serviceTypeInput
        );
        assert.ok(serviceTypeRecord);

        const decodedServiceType = decode(
          (serviceTypeRecord.entry as any).Present.entry
        ) as ServiceType;
        assert.equal(decodedServiceType.name, "Web Development");
        assert.equal(
          decodedServiceType.description,
          "Frontend and backend web development services"
        );
        assert.deepEqual(decodedServiceType.tags, [
          "javascript",
          "react",
          "nodejs",
        ]);

        // Sync after creating service type
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test getting all service types
        const allServiceTypes: Record[] = await getAllServiceTypes(
          alice.cells[0]
        );
        assert.lengthOf(allServiceTypes, 1);
        const firstServiceType = decode(
          (allServiceTypes[0].entry as any).Present.entry
        ) as ServiceType;
        assert.equal(firstServiceType.name, decodedServiceType.name);

        // Test getting a specific service type
        const retrievedServiceType: Record | null = await getServiceType(
          alice.cells[0],
          serviceTypeRecord.signed_action.hashed.hash
        );
        assert.ok(retrievedServiceType);
        const retrievedDecoded = decode(
          (retrievedServiceType.entry as any).Present.entry
        ) as ServiceType;
        assert.deepEqual(retrievedDecoded, decodedServiceType);

        // Test updating service type
        const updatedServiceType = {
          ...serviceType,
          description: "Updated description for web development",
          tags: ["javascript", "react", "nodejs", "typescript"],
        };

        const updateResult = await updateServiceType(alice.cells[0], {
          original_service_type_hash:
            serviceTypeRecord.signed_action.hashed.hash,
          previous_service_type_hash:
            serviceTypeRecord.signed_action.hashed.hash,
          updated_service_type: updatedServiceType,
        });
        assert.ok(updateResult);

        // Sync after update
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify the service type was updated
        const updatedRecord = await getLatestServiceTypeRecord(
          alice.cells[0],
          serviceTypeRecord.signed_action.hashed.hash
        );
        assert.ok(updatedRecord);
        const updatedDecoded = decode(
          (updatedRecord.entry as any).Present.entry
        ) as ServiceType;
        assert.equal(
          updatedDecoded.description,
          "Updated description for web development"
        );
        assert.lengthOf(updatedDecoded.tags, 4);

        // Note: Authorization tests for Bob are in a separate test

        // Test deleting service type (Alice as admin)
        const deleteResult = await deleteServiceType(
          alice.cells[0],
          serviceTypeRecord.signed_action.hashed.hash
        );
        assert.ok(deleteResult);

        // Final sync after delete
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify the service type was deleted
        const allServiceTypesAfterDelete = await getAllServiceTypes(
          alice.cells[0]
        );
        assert.lengthOf(allServiceTypesAfterDelete, 0);
      }
    );
  },
  {
    timeout: 180000, // 5 minutes
  }
);

// Test for ServiceType validation
test(
  "ServiceType validation",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, _bob: Player) => {
        // Create user for Alice
        const aliceUser = sampleUser({ name: "Alice" });
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        assert.ok(aliceUserRecord);

        // Register Alice as network administrator
        await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );

        // Sync after setup
        await dhtSync([alice], alice.cells[0].cell_id[0]);

        // Test validation - empty name should fail
        const invalidServiceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceType({
            name: "",
            description: "Valid description",
          }),
        };

        await expect(
          createServiceType(alice.cells[0], invalidServiceTypeInput)
        ).rejects.toThrow();

        // Test validation - empty description should fail
        const invalidServiceTypeInput2: ServiceTypeInput = {
          service_type: sampleServiceType({
            name: "Valid Name",
            description: "",
          }),
        };

        await expect(
          createServiceType(alice.cells[0], invalidServiceTypeInput2)
        ).rejects.toThrow();
      }
    );
  },
  {
    timeout: 180000,
  }
);

// Test for ServiceType admin permissions
test(
  "ServiceType admin permissions",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        // Create users for Alice and Bob
        const aliceUser = sampleUser({ name: "Alice" });
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        const bobUser = sampleUser({ name: "Bob" });
        const bobUserRecord = await createUser(bob.cells[0], bobUser);

        // Sync after creating users
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test that Bob (non-admin) cannot create service types
        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceType({
            name: "Design Services",
            description: "UI/UX and graphic design services",
            tags: ["design", "ui", "ux"],
          }),
        };

        await expect(
          createServiceType(bob.cells[0], serviceTypeInput)
        ).rejects.toThrow();

        // Register Alice as network administrator
        await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );

        // Sync after registering admin
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test that Alice (admin) can create service types
        const serviceTypeRecord = await createServiceType(
          alice.cells[0],
          serviceTypeInput
        );
        assert.ok(serviceTypeRecord);

        // Sync after creating service type
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify the service type was created
        const allServiceTypes = await getAllServiceTypes(alice.cells[0]);
        assert.lengthOf(allServiceTypes, 1);
      }
    );
  },
  {
    timeout: 180000,
  }
);

// Test for ServiceType linking functionality
test(
  "ServiceType linking with requests and offers",
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

        // Test manual linking
        const mockRequestHash = webDevServiceType.signed_action.hashed.hash; // Using as mock

        await linkToServiceType(alice.cells[0], {
          service_type_hash: webDevServiceType.signed_action.hashed.hash,
          action_hash: mockRequestHash,
          entity: "request",
        });

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test getting requests for service type
        const requestsForWebDev = await getRequestsForServiceType(
          alice.cells[0],
          webDevServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(requestsForWebDev, 1);

        // Test getting service types for entity
        const serviceTypesForRequest = await getServiceTypesForEntity(
          alice.cells[0],
          {
            original_action_hash: mockRequestHash,
            entity: "request",
          }
        );
        assert.lengthOf(serviceTypesForRequest, 1);
        assert.equal(
          serviceTypesForRequest[0].toString(),
          webDevServiceType.signed_action.hashed.hash.toString()
        );

        // Test unlinking
        await unlinkFromServiceType(alice.cells[0], {
          service_type_hash: webDevServiceType.signed_action.hashed.hash,
          action_hash: mockRequestHash,
          entity: "request",
        });

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify unlink worked
        const requestsAfterUnlink = await getRequestsForServiceType(
          alice.cells[0],
          webDevServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(requestsAfterUnlink, 0);
      }
    );
  },
  {
    timeout: 180000,
  }
);

// Test for ServiceType update links functionality
test(
  "ServiceType update links management",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        // Setup users and admin
        const aliceUser = sampleUser({ name: "Alice" });
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        const bobUser = sampleUser({ name: "Bob" });
        await createUser(bob.cells[0], bobUser);

        await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create multiple service types
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

        // Mock entity hash
        const mockEntityHash = webDevServiceType.signed_action.hashed.hash;

        // Test updating service type links - start with web dev and design
        const initialServiceTypes = [
          webDevServiceType.signed_action.hashed.hash,
          designServiceType.signed_action.hashed.hash,
        ];

        await updateServiceTypeLinks(alice.cells[0], {
          action_hash: mockEntityHash,
          entity: "request",
          new_service_type_hashes: initialServiceTypes,
        });

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify initial links
        let serviceTypesForEntity = await getServiceTypesForEntity(
          alice.cells[0],
          {
            original_action_hash: mockEntityHash,
            entity: "request",
          }
        );
        assert.lengthOf(serviceTypesForEntity, 2);

        // Test updating links - remove design, add marketing
        const updatedServiceTypes = [
          webDevServiceType.signed_action.hashed.hash,
          marketingServiceType.signed_action.hashed.hash,
        ];

        await updateServiceTypeLinks(alice.cells[0], {
          action_hash: mockEntityHash,
          entity: "request",
          new_service_type_hashes: updatedServiceTypes,
        });

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify updated links
        serviceTypesForEntity = await getServiceTypesForEntity(alice.cells[0], {
          original_action_hash: mockEntityHash,
          entity: "request",
        });
        assert.lengthOf(serviceTypesForEntity, 2);

        // Verify design service type no longer has links to this entity
        const requestsForDesign = await getRequestsForServiceType(
          alice.cells[0],
          designServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(requestsForDesign, 0);

        // Verify marketing service type now has links
        const requestsForMarketing = await getRequestsForServiceType(
          alice.cells[0],
          marketingServiceType.signed_action.hashed.hash
        );
        assert.lengthOf(requestsForMarketing, 1);
      }
    );
  },
  {
    timeout: 180000,
  }
);

// Test for ServiceType deletion with cleanup
test(
  "ServiceType deletion and link cleanup",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        // Setup users and admin
        const aliceUser = sampleUser({ name: "Alice" });
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        const bobUser = sampleUser({ name: "Bob" });
        await createUser(bob.cells[0], bobUser);

        await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create service type
        const serviceType = await createServiceType(alice.cells[0], {
          service_type: sampleServiceType({
            name: "Test Service",
            description: "Test service for deletion",
          }),
        });

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create links to mock entities
        const mockRequestHash = serviceType.signed_action.hashed.hash;
        const mockOfferHash = serviceType.signed_action.hashed.hash;

        await linkToServiceType(alice.cells[0], {
          service_type_hash: serviceType.signed_action.hashed.hash,
          action_hash: mockRequestHash,
          entity: "request",
        });

        await linkToServiceType(alice.cells[0], {
          service_type_hash: serviceType.signed_action.hashed.hash,
          action_hash: mockOfferHash,
          entity: "offer",
        });

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify links exist
        const requestsBeforeDelete = await getRequestsForServiceType(
          alice.cells[0],
          serviceType.signed_action.hashed.hash
        );
        const offersBeforeDelete = await getOffersForServiceType(
          alice.cells[0],
          serviceType.signed_action.hashed.hash
        );
        assert.lengthOf(requestsBeforeDelete, 1);
        assert.lengthOf(offersBeforeDelete, 1);

        // Test entity deletion cleanup
        await deleteAllServiceTypeLinksForEntity(alice.cells[0], {
          original_action_hash: mockRequestHash,
          entity: "request",
        });

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify request links are cleaned up
        const requestsAfterCleanup = await getRequestsForServiceType(
          alice.cells[0],
          serviceType.signed_action.hashed.hash
        );
        assert.lengthOf(requestsAfterCleanup, 0);

        // Verify offer links still exist
        const offersAfterCleanup = await getOffersForServiceType(
          alice.cells[0],
          serviceType.signed_action.hashed.hash
        );
        assert.lengthOf(offersAfterCleanup, 1);
      }
    );
  },
  {
    timeout: 180000,
  }
);

// Test for ServiceType error handling
test(
  "ServiceType error handling and edge cases",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        // Setup users and admin
        const aliceUser = sampleUser({ name: "Alice" });
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        const bobUser = sampleUser({ name: "Bob" });
        await createUser(bob.cells[0], bobUser);

        await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create a real service type for testing
        const serviceType = await createServiceType(alice.cells[0], {
          service_type: sampleServiceType({ name: "Test Service" }),
        });

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test linking with invalid entity type
        await expect(
          linkToServiceType(alice.cells[0], {
            service_type_hash: serviceType.signed_action.hashed.hash,
            action_hash: serviceType.signed_action.hashed.hash,
            entity: "invalid_entity",
          })
        ).rejects.toThrow();

        // Test getting service types for invalid entity
        await expect(
          getServiceTypesForEntity(alice.cells[0], {
            original_action_hash: serviceType.signed_action.hashed.hash,
            entity: "invalid_entity",
          })
        ).rejects.toThrow();

        // Test unauthorized operations (Bob trying admin functions)
        await expect(
          updateServiceType(bob.cells[0], {
            original_service_type_hash: serviceType.signed_action.hashed.hash,
            previous_service_type_hash: serviceType.signed_action.hashed.hash,
            updated_service_type: sampleServiceType({ name: "Updated" }),
          })
        ).rejects.toThrow();

        await expect(
          deleteServiceType(bob.cells[0], serviceType.signed_action.hashed.hash)
        ).rejects.toThrow();

        // Test creating service type with Bob (non-admin) - should fail
        await expect(
          createServiceType(bob.cells[0], {
            service_type: sampleServiceType({ name: "Bob's Service" }),
          })
        ).rejects.toThrow();
      }
    );
  },
  {
    timeout: 180000,
  }
);
