import { assert, test } from "vitest";
import { Scenario, Player, dhtSync } from "@holochain/tryorama";
import { decodeRecords, runScenarioWithTwoAgents } from "../../utils";
import { createUser, sampleUser, getUserStatusLink } from "../../users/common";
import { registerNetworkAdministrator } from "../../administration/common";
import {
  getLatestStatusRecordForEntity,
  updateEntityStatus,
  AdministrationEntity,
} from "../../administration/common";
import { ServiceType, ServiceTypeInput } from "../common";
import {
  suggestServiceType,
  getPendingServiceTypes,
  sampleServiceTypeForStatus,
} from "./common";

/**
 * Tests for the user suggestion flow of service types
 */
test(
  "Only accepted users can suggest service types",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        const aliceUser = sampleUser({
          name: "alice",
          email: "alice@test.com",
        });
        const bobUser = sampleUser({
          name: "bob",
          email: "bob@test.com",
        });

        // Setup: Create users (they start with "pending" status)
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        const aliceUserHash = aliceUserRecord.signed_action.hashed.hash;
        const bobUserRecord = await createUser(bob.cells[0], bobUser);
        const bobUserHash = bobUserRecord.signed_action.hashed.hash;

        // Register Alice as admin
        await registerNetworkAdministrator(alice.cells[0], aliceUserHash, [
          alice.agentPubKey,
        ]);

        // Sync DHT
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test 1: Bob (pending user) tries to suggest a service type - should fail
        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "Unauthorized Suggestion",
            description: "This should fail",
            tags: ["pending", "user"],
          }),
        };

        try {
          await suggestServiceType(bob.cells[0], serviceTypeInput);
          assert.fail(
            "Pending user should not be able to suggest service types"
          );
        } catch (error) {
          assert.ok(error.toString().includes("Unauthorized"));
        }

        // Accept Bob's user status
        const bobStatusLink = await getUserStatusLink(
          alice.cells[0],
          bobUserHash
        );
        assert.ok(bobStatusLink, "Bob's status link should exist");
        const bobStatusOriginalActionHash = bobStatusLink.target;

        const bobLatestStatusRecord = await getLatestStatusRecordForEntity(
          alice.cells[0],
          AdministrationEntity.Users,
          bobUserHash
        );
        assert.ok(
          bobLatestStatusRecord,
          "Bob's latest status record should exist"
        );

        await updateEntityStatus(
          alice.cells[0],
          AdministrationEntity.Users,
          bobUserHash,
          bobStatusOriginalActionHash,
          bobLatestStatusRecord.signed_action.hashed.hash,
          {
            status_type: "accepted",
          }
        );

        // Sync DHT after status update
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test 2: Bob (now accepted user) suggests a service type - should succeed
        const acceptedUserServiceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "Accepted User Suggestion",
            description: "A service type suggested by an accepted user",
            tags: ["accepted", "user", "suggested"],
          }),
        };

        const suggestion = await suggestServiceType(
          bob.cells[0],
          acceptedUserServiceTypeInput
        );

        // Verify suggestion was created
        assert.ok(suggestion);

        // Sync DHT
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify it appears in pending list (admin only)
        const pendingTypes = await getPendingServiceTypes(alice.cells[0]);
        assert.ok(pendingTypes.length >= 1);

        // Find our suggestion in the pending list
        const foundSuggestion = pendingTypes.find(
          (record) =>
            record.signed_action.hashed.hash.toString() ===
            suggestion.signed_action.hashed.hash.toString()
        );
        assert.ok(
          foundSuggestion,
          "Suggested service type not found in pending list"
        );

        // Verify the content matches what was suggested
        const record = foundSuggestion;
        assert.ok(record);
        const decodedRecords = decodeRecords([record]);
        assert.ok(decodedRecords && decodedRecords.length > 0);
        const serviceType = decodedRecords[0] as ServiceType;
        assert.equal(serviceType.name, "Accepted User Suggestion");
        assert.equal(
          serviceType.description,
          "A service type suggested by an accepted user"
        );
      }
    );
  },
  { timeout: 180000 }
);

test(
  "Regular users cannot access pending service types list",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        // Setup: Alice as admin, Bob as regular user
        const aliceUser = sampleUser({
          name: "alice",
          email: "alice@test.com",
        });
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        const bobUser = sampleUser({
          name: "bob",
          email: "bob@test.com",
        });
        const bobUserRecord = await createUser(bob.cells[0], bobUser);
        const bobUserHash = bobUserRecord.signed_action.hashed.hash;

        // Register Alice as admin
        await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );

        // Sync DHT first to ensure status links are available
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Accept Bob so he can suggest service types
        const bobStatusLink = await getUserStatusLink(
          alice.cells[0],
          bobUserHash
        );
        assert.ok(bobStatusLink, "Bob's status link should exist");
        const bobStatusOriginalActionHash = bobStatusLink.target;

        const bobLatestStatusRecord = await getLatestStatusRecordForEntity(
          alice.cells[0],
          AdministrationEntity.Users,
          bobUserHash
        );
        assert.ok(
          bobLatestStatusRecord,
          "Bob's latest status record should exist"
        );

        await updateEntityStatus(
          alice.cells[0],
          AdministrationEntity.Users,
          bobUserHash,
          bobStatusOriginalActionHash,
          bobLatestStatusRecord.signed_action.hashed.hash,
          {
            status_type: "accepted",
          }
        );

        // Sync DHT after status update
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Bob suggests a service type
        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "Another Suggested Service",
          }),
        };

        await suggestServiceType(bob.cells[0], serviceTypeInput);

        // Sync DHT
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify regular user cannot access pending list
        try {
          await getPendingServiceTypes(bob.cells[0]);
          assert.fail(
            "Regular user should not be able to access pending service types"
          );
        } catch (error) {
          assert.ok(error.toString().includes("Unauthorized"));
        }
      }
    );
  },
  { timeout: 180000 }
);
