import { assert, test, expect, describe } from "vitest";
import { Player, dhtSync } from "@holochain/tryorama";
import { runScenarioWithTwoAgents } from "../../utils";
import { createUser, sampleUser } from "../../users/common";
import { registerNetworkAdministrator } from "../../administration/common";
import { deleteServiceType, ServiceTypeInput } from "../common";
import {
  suggestServiceType,
  getPendingServiceTypes,
  getApprovedServiceTypes,
  getRejectedServiceTypes,
  approveServiceType,
  rejectServiceType,
  rejectApprovedServiceType,
  isServiceTypeApproved,
  sampleServiceTypeForStatus,
} from "./common";

// Helper function to set up a scenario with an admin and a regular user
async function setupScenario(
  callback: (alice: Player, bob: Player) => Promise<void>
) {
  await runScenarioWithTwoAgents(async (_scenario, alice, bob) => {
    const aliceUser = sampleUser({ name: "Alice", email: "alice@test.com" });
    const bobUser = sampleUser({ name: "Bob", email: "bob@test.com" });

    const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
    await createUser(bob.cells[0], bobUser);

    await registerNetworkAdministrator(
      alice.cells[0],
      aliceUserRecord.signed_action.hashed.hash,
      [alice.agentPubKey]
    );

    await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

    await callback(alice, bob);
  });
}

describe("Admin Moderation of Service Types", () => {
  describe("Pending Service Types", () => {
    test(
      "Admin can approve a pending service type",
      async () => {
        await setupScenario(async (alice, bob) => {
          const serviceTypeInput: ServiceTypeInput = {
            service_type: sampleServiceTypeForStatus({
              name: "Service To Approve",
            }),
          };
          const suggestion = await suggestServiceType(
            bob.cells[0],
            serviceTypeInput
          );
          const pendingHash = suggestion.signed_action.hashed.hash;

          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          const pendingBefore = await getPendingServiceTypes(alice.cells[0]);
          assert.equal(
            pendingBefore.filter(
              (r) =>
                r.signed_action.hashed.hash.toString() ===
                pendingHash.toString()
            ).length,
            1
          );

          await approveServiceType(alice.cells[0], pendingHash);
          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          const approvedAfter = await getApprovedServiceTypes(alice.cells[0]);
          assert.equal(
            approvedAfter.filter(
              (r) =>
                r.signed_action.hashed.hash.toString() ===
                pendingHash.toString()
            ).length,
            1
          );

          const pendingAfter = await getPendingServiceTypes(alice.cells[0]);
          assert.equal(
            pendingAfter.filter(
              (r) =>
                r.signed_action.hashed.hash.toString() ===
                pendingHash.toString()
            ).length,
            0
          );

          const isApproved = await isServiceTypeApproved(
            alice.cells[0],
            pendingHash
          );
          assert.isTrue(isApproved);
        });
      },
      { timeout: 180000 }
    );

    test(
      "Admin can reject a pending service type",
      async () => {
        await setupScenario(async (alice, bob) => {
          const serviceTypeInput: ServiceTypeInput = {
            service_type: sampleServiceTypeForStatus({
              name: "Service To Reject",
            }),
          };
          const suggestion = await suggestServiceType(
            bob.cells[0],
            serviceTypeInput
          );
          const pendingHash = suggestion.signed_action.hashed.hash;

          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          await rejectServiceType(alice.cells[0], pendingHash);
          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          const rejectedAfter = await getRejectedServiceTypes(alice.cells[0]);
          assert.equal(
            rejectedAfter.filter(
              (r) =>
                r.signed_action.hashed.hash.toString() ===
                pendingHash.toString()
            ).length,
            1
          );

          const pendingAfter = await getPendingServiceTypes(alice.cells[0]);
          assert.equal(pendingAfter.length, 0);

          const isApproved = await isServiceTypeApproved(
            alice.cells[0],
            pendingHash
          );
          assert.isFalse(isApproved);
        });
      },
      { timeout: 180000 }
    );
  });

  describe("Approved Service Types", () => {
    test(
      "Admin can reject an already approved service type",
      async () => {
        await setupScenario(async (alice, bob) => {
          const serviceTypeInput: ServiceTypeInput = {
            service_type: sampleServiceTypeForStatus({
              name: "Service to Approve then Reject",
            }),
          };
          const suggestion = await suggestServiceType(
            bob.cells[0],
            serviceTypeInput
          );
          const serviceTypeHash = suggestion.signed_action.hashed.hash;

          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          await approveServiceType(alice.cells[0], serviceTypeHash);
          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          const isApprovedBefore = await isServiceTypeApproved(
            alice.cells[0],
            serviceTypeHash
          );
          assert.isTrue(isApprovedBefore);

          await rejectApprovedServiceType(alice.cells[0], serviceTypeHash);
          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          const rejectedAfter = await getRejectedServiceTypes(alice.cells[0]);
          assert.equal(
            rejectedAfter.filter(
              (r) =>
                r.signed_action.hashed.hash.toString() ===
                serviceTypeHash.toString()
            ).length,
            1
          );

          const approvedAfter = await getApprovedServiceTypes(alice.cells[0]);
          assert.equal(
            approvedAfter.filter(
              (r) =>
                r.signed_action.hashed.hash.toString() ===
                serviceTypeHash.toString()
            ).length,
            0
          );

          const isApprovedAfter = await isServiceTypeApproved(
            alice.cells[0],
            serviceTypeHash
          );
          assert.isFalse(isApprovedAfter);
        });
      },
      { timeout: 180000 }
    );
  });

  describe("Rejected Service Types", () => {
    test.only(
      "Admin can approve a rejected service type directly",
      async () => {
        await setupScenario(async (alice, bob) => {
          const serviceTypeInput: ServiceTypeInput = {
            service_type: sampleServiceTypeForStatus({
              name: "Service to Reject then Approve",
            }),
          };
          const suggestion = await suggestServiceType(
            bob.cells[0],
            serviceTypeInput
          );
          const serviceTypeHash = suggestion.signed_action.hashed.hash;

          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          // First reject the service type
          await rejectServiceType(alice.cells[0], serviceTypeHash);
          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          // Verify it's in rejected state
          const rejectedBefore = await getRejectedServiceTypes(alice.cells[0]);
          assert.equal(
            rejectedBefore.filter(
              (r) =>
                r.signed_action.hashed.hash.toString() ===
                serviceTypeHash.toString()
            ).length,
            1
          );

          // Now approve it directly from rejected state
          await approveServiceType(alice.cells[0], serviceTypeHash);
          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          // Verify it's now in approved state
          const approvedAfter = await getApprovedServiceTypes(alice.cells[0]);
          assert.equal(
            approvedAfter.filter(
              (r) =>
                r.signed_action.hashed.hash.toString() ===
                serviceTypeHash.toString()
            ).length,
            1
          );

          // Verify it's no longer in rejected state
          const rejectedAfter = await getRejectedServiceTypes(alice.cells[0]);
          assert.equal(
            rejectedAfter.filter(
              (r) =>
                r.signed_action.hashed.hash.toString() ===
                serviceTypeHash.toString()
            ).length,
            0
          );

          // Verify isServiceTypeApproved returns true
          const isApproved = await isServiceTypeApproved(
            alice.cells[0],
            serviceTypeHash
          );
          assert.isTrue(isApproved);
        });
      },
      { timeout: 180000 }
    );

    test(
      "Admin can delete a rejected service type",
      async () => {
        await setupScenario(async (alice, bob) => {
          const serviceTypeInput: ServiceTypeInput = {
            service_type: sampleServiceTypeForStatus({
              name: "Service to Reject then Delete",
            }),
          };
          const suggestion = await suggestServiceType(
            bob.cells[0],
            serviceTypeInput
          );
          const serviceTypeHash = suggestion.signed_action.hashed.hash;

          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          // First reject the service type
          await rejectServiceType(alice.cells[0], serviceTypeHash);
          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          // Verify it's in rejected state
          const rejectedBefore = await getRejectedServiceTypes(alice.cells[0]);
          assert.equal(
            rejectedBefore.filter(
              (r) =>
                r.signed_action.hashed.hash.toString() ===
                serviceTypeHash.toString()
            ).length,
            1
          );

          // Now delete the rejected service type
          await deleteServiceType(alice.cells[0], serviceTypeHash);
          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          // Verify it's no longer in rejected state
          const rejectedAfter = await getRejectedServiceTypes(alice.cells[0]);
          assert.equal(
            rejectedAfter.filter(
              (r) =>
                r.signed_action.hashed.hash.toString() ===
                serviceTypeHash.toString()
            ).length,
            0
          );

          // Verify it's not in approved state either
          const approvedAfter = await getApprovedServiceTypes(alice.cells[0]);
          assert.equal(
            approvedAfter.filter(
              (r) =>
                r.signed_action.hashed.hash.toString() ===
                serviceTypeHash.toString()
            ).length,
            0
          );
        });
      },
      { timeout: 180000 }
    );
  });

  describe("Access Control", () => {
    test(
      "Non-admin cannot moderate service types",
      async () => {
        await runScenarioWithTwoAgents(async (_scenario, alice, bob) => {
          // No admin is registered in this scenario
          await createUser(alice.cells[0], sampleUser({ name: "Alice" }));
          await createUser(bob.cells[0], sampleUser({ name: "Bob" }));
          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          const serviceTypeInput: ServiceTypeInput = {
            service_type: sampleServiceTypeForStatus({
              name: "Unauthorized Moderation Test",
            }),
          };
          const suggestion = await suggestServiceType(
            bob.cells[0],
            serviceTypeInput
          );
          const serviceTypeHash = suggestion.signed_action.hashed.hash;
          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          // Alice (non-admin) tries to approve
          await expect(
            approveServiceType(alice.cells[0], serviceTypeHash)
          ).rejects.toThrow(/Unauthorized/);

          // Bob (non-admin) tries to reject
          await expect(
            rejectServiceType(bob.cells[0], serviceTypeHash)
          ).rejects.toThrow(/Unauthorized/);

          // Non-admin trying to get pending service types should also fail
          await expect(getPendingServiceTypes(alice.cells[0])).rejects.toThrow(
            /Unauthorized/
          );

          // Service type should still be in the system (can verify with approved list which is public)
          const approvedList = await getApprovedServiceTypes(alice.cells[0]);
          // It should not be in approved list since it was never approved
          const foundInApproved = approvedList.some(
            (r) =>
              r.signed_action.hashed.hash.toString() ===
              serviceTypeHash.toString()
          );
          assert.isFalse(
            foundInApproved,
            "Service type should not be in approved list"
          );
        });
      },
      { timeout: 180000 }
    );
  });
});
