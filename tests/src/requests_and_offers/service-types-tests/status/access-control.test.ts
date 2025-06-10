import { assert, test, expect, describe } from "vitest";
import { Player, dhtSync } from "@holochain/tryorama";
import { runScenarioWithTwoAgents } from "../../utils";
import { createUser, sampleUser } from "../../users/common";
import { registerNetworkAdministrator } from "../../administration/common";
import { ServiceTypeInput, createServiceType } from "../common";
import {
  suggestServiceType,
  getPendingServiceTypes,
  getApprovedServiceTypes,
  getRejectedServiceTypes,
  approveServiceType,
  rejectServiceType,
  sampleServiceTypeForStatus,
} from "./common";

/**
 * Helper function to set up the scenario with an admin and a regular user.
 */
async function setupScenario(alice: Player, bob: Player) {
  const aliceUser = sampleUser({ name: "Alice", email: "alice@test.com" });
  const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
  assert.ok(aliceUserRecord);

  const bobUser = sampleUser({ name: "Bob", email: "bob@test.com" });
  const bobUserRecord = await createUser(bob.cells[0], bobUser);
  assert.ok(bobUserRecord);

  await registerNetworkAdministrator(
    alice.cells[0],
    aliceUserRecord.signed_action.hashed.hash,
    [alice.agentPubKey]
  );

  await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

  return { alice, bob };
}

describe("Service Type Status: Access Control", () => {
  test(
    "Admins can access all status lists; regular users only approved",
    async () => {
      await runScenarioWithTwoAgents(async (_scenario, alice, bob) => {
        await setupScenario(alice, bob);

        // Bob suggests three service types
        const pendingInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({ name: "Pending Service" }),
        };
        const pendingRecord = await suggestServiceType(bob.cells[0], pendingInput);
        assert.ok(pendingRecord);

        const toApproveInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({ name: "To Be Approved" }),
        };
        const toApproveRecord = await suggestServiceType(bob.cells[0], toApproveInput);
        assert.ok(toApproveRecord);

        const toRejectInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({ name: "To Be Rejected" }),
        };
        const toRejectRecord = await suggestServiceType(bob.cells[0], toRejectInput);
        assert.ok(toRejectRecord);

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Alice (admin) moderates the suggestions
        await approveServiceType(alice.cells[0], toApproveRecord.signed_action.hashed.hash);
        await rejectServiceType(alice.cells[0], toRejectRecord.signed_action.hashed.hash);

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Admin access checks
        const adminPending = await getPendingServiceTypes(alice.cells[0]);
        assert.lengthOf(adminPending, 1);
        assert.deepEqual(adminPending[0].signed_action.hashed.hash, pendingRecord.signed_action.hashed.hash);

        const adminRejected = await getRejectedServiceTypes(alice.cells[0]);
        assert.lengthOf(adminRejected, 1);

        const adminApproved = await getApprovedServiceTypes(alice.cells[0]);
        assert.lengthOf(adminApproved, 1);

        // Regular user access checks
        await expect(getPendingServiceTypes(bob.cells[0])).rejects.toThrow("Unauthorized");
        await expect(getRejectedServiceTypes(bob.cells[0])).rejects.toThrow("Unauthorized");

        const userApproved = await getApprovedServiceTypes(bob.cells[0]);
        assert.lengthOf(userApproved, 1);
        assert.deepEqual(userApproved[0].signed_action.hashed.hash, toApproveRecord.signed_action.hashed.hash);
      });
    },
    { timeout: 180000 }
  );

  test(
    "Regular users cannot call create_service_type directly",
    async () => {
      await runScenarioWithTwoAgents(async (_scenario, alice, bob) => {
        await setupScenario(alice, bob);

        const directCreateInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({ name: "Direct Creation Attempt" }),
        };

        // Bob (non-admin) attempts to create a service type directly
        await expect(createServiceType(bob.cells[0], directCreateInput)).rejects.toThrow("Unauthorized");
      });
    },
    { timeout: 180000 }
  );

  test(
    "Regular users can suggest a service type",
    async () => {
      await runScenarioWithTwoAgents(async (_scenario, alice, bob) => {
        await setupScenario(alice, bob);

        const suggestionInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({ name: "Valid Suggestion" }),
        };

        const suggestionRecord = await suggestServiceType(bob.cells[0], suggestionInput);
        assert.ok(suggestionRecord);

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify the suggestion is in the pending list for the admin
        const adminPending = await getPendingServiceTypes(alice.cells[0]);
        assert.lengthOf(adminPending, 1);
        assert.deepEqual(adminPending[0].signed_action.hashed.hash, suggestionRecord.signed_action.hashed.hash);
      });
    },
    { timeout: 180000 }
  );
});
