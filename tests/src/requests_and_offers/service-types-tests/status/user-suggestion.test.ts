import { assert, test } from "vitest";
import { Scenario, Player, dhtSync } from "@holochain/tryorama";
import { decodeRecords, runScenarioWithTwoAgents } from "../../utils";
import { createUser, sampleUser } from "../../users/common";
import { registerNetworkAdministrator } from "../../administration/common";
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
  "User can suggest service types which appear in pending list",
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

        // Setup: Alice as admin, Bob as regular user
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        const bobUserRecord = await createUser(bob.cells[0], bobUser); // eslint-disable-line @typescript-eslint/no-unused-vars

        // Register Alice as admin
        await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );

        // Bob suggests a service type
        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "User Suggested Service",
            description: "A service type suggested by a regular user",
            tags: ["user", "suggested"],
          }),
        };

        const suggestion = await suggestServiceType(
          bob.cells[0],
          serviceTypeInput
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
          (record) => record.signed_action.hashed.hash.toString() ===
            suggestion.signed_action.hashed.hash.toString()
        );
        assert.ok(foundSuggestion, "Suggested service type not found in pending list");

        // Verify the content matches what was suggested
        const record = foundSuggestion;
        assert.ok(record);
        const decodedRecords = decodeRecords([record]);
        assert.ok(decodedRecords && decodedRecords.length > 0);
        const serviceType = decodedRecords[0] as ServiceType;
        assert.equal(serviceType.name, "User Suggested Service");
        assert.equal(serviceType.description, "A service type suggested by a regular user");
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
        const bobUserRecord = await createUser(bob.cells[0], bobUser); // eslint-disable-line @typescript-eslint/no-unused-vars

        // Register Alice as admin
        await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );

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
          assert.fail("Regular user should not be able to access pending service types");
        } catch (error) {
          assert.ok(error.toString().includes("Unauthorized"));
        }
      }
    );
  },
  { timeout: 180000 }
);
