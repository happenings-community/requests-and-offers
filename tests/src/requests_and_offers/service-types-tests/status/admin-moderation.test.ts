import { assert, test, expect, describe } from "vitest";
import { Player, PlayerApp, dhtSync } from "@holochain/tryorama";
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
  callback: (alice: PlayerApp, bob: PlayerApp) => Promise<void>,
) {
  await runScenarioWithTwoAgents(async (_scenario, alice, bob) => {
    // Access the requests_and_offers DNA cells by role name
    const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
    const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

    const aliceUser = sampleUser({ name: "Alice", email: "alice@test.com" });
    const bobUser = sampleUser({ name: "Bob", email: "bob@test.com" });

    const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
    await createUser(bobRequestsAndOffers, bobUser);

    await registerNetworkAdministrator(
      aliceRequestsAndOffers,
      aliceUserRecord.signed_action.hashed.hash,
      [alice.agentPubKey],
    );

    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    await callback(alice, bob);
  });
}

describe("Admin Moderation of Service Types", () => {
  describe("Pending Service Types", () => {
    test("Admin can approve a pending service type", async () => {
      await setupScenario(async (alice, bob) => {
        // Access the requests_and_offers DNA cells by role name
        const aliceRequestsAndOffers = alice.namedCells.get(
          "requests_and_offers",
        )!;
        const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "Service To Approve",
          }),
        };
        const suggestion = await suggestServiceType(
          bobRequestsAndOffers,
          serviceTypeInput,
        );
        const pendingHash = suggestion.signed_action.hashed.hash;

        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        const pendingBefore = await getPendingServiceTypes(
          aliceRequestsAndOffers,
        );
        assert.equal(
          pendingBefore.filter(
            (r) =>
              r.signed_action.hashed.hash.toString() === pendingHash.toString(),
          ).length,
          1,
        );

        await approveServiceType(aliceRequestsAndOffers, pendingHash);
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        const approvedAfter = await getApprovedServiceTypes(
          aliceRequestsAndOffers,
        );
        assert.equal(
          approvedAfter.filter(
            (r) =>
              r.signed_action.hashed.hash.toString() === pendingHash.toString(),
          ).length,
          1,
        );

        const pendingAfter = await getPendingServiceTypes(
          aliceRequestsAndOffers,
        );
        assert.equal(
          pendingAfter.filter(
            (r) =>
              r.signed_action.hashed.hash.toString() === pendingHash.toString(),
          ).length,
          0,
        );

        const isApproved = await isServiceTypeApproved(
          aliceRequestsAndOffers,
          pendingHash,
        );
        assert.isTrue(isApproved);
      });
    });

    test("Admin can reject a pending service type", async () => {
      await setupScenario(async (alice, bob) => {
        // Access the requests_and_offers DNA cells by role name
        const aliceRequestsAndOffers = alice.namedCells.get(
          "requests_and_offers",
        )!;
        const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "Service To Reject",
          }),
        };
        const suggestion = await suggestServiceType(
          bobRequestsAndOffers,
          serviceTypeInput,
        );
        const pendingHash = suggestion.signed_action.hashed.hash;

        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        await rejectServiceType(aliceRequestsAndOffers, pendingHash);
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        const rejectedAfter = await getRejectedServiceTypes(
          aliceRequestsAndOffers,
        );
        assert.equal(
          rejectedAfter.filter(
            (r) =>
              r.signed_action.hashed.hash.toString() === pendingHash.toString(),
          ).length,
          1,
        );

        const pendingAfter = await getPendingServiceTypes(
          aliceRequestsAndOffers,
        );
        assert.equal(pendingAfter.length, 0);

        const isApproved = await isServiceTypeApproved(
          aliceRequestsAndOffers,
          pendingHash,
        );
        assert.isFalse(isApproved);
      });
    });
  });

  describe("Approved Service Types", () => {
    test("Admin can reject an already approved service type", async () => {
      await setupScenario(async (alice, bob) => {
        // Access the requests_and_offers DNA cells by role name
        const aliceRequestsAndOffers = alice.namedCells.get(
          "requests_and_offers",
        )!;
        const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "Service to Approve then Reject",
          }),
        };
        const suggestion = await suggestServiceType(
          bobRequestsAndOffers,
          serviceTypeInput,
        );
        const serviceTypeHash = suggestion.signed_action.hashed.hash;

        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        await approveServiceType(aliceRequestsAndOffers, serviceTypeHash);
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        const isApprovedBefore = await isServiceTypeApproved(
          aliceRequestsAndOffers,
          serviceTypeHash,
        );
        assert.isTrue(isApprovedBefore);

        await rejectApprovedServiceType(
          aliceRequestsAndOffers,
          serviceTypeHash,
        );
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        const rejectedAfter = await getRejectedServiceTypes(
          aliceRequestsAndOffers,
        );
        assert.equal(
          rejectedAfter.filter(
            (r) =>
              r.signed_action.hashed.hash.toString() ===
              serviceTypeHash.toString(),
          ).length,
          1,
        );

        const approvedAfter = await getApprovedServiceTypes(
          aliceRequestsAndOffers,
        );
        assert.equal(
          approvedAfter.filter(
            (r) =>
              r.signed_action.hashed.hash.toString() ===
              serviceTypeHash.toString(),
          ).length,
          0,
        );

        const isApprovedAfter = await isServiceTypeApproved(
          aliceRequestsAndOffers,
          serviceTypeHash,
        );
        assert.isFalse(isApprovedAfter);
      });
    });
  });

  describe("Rejected Service Types", () => {
    test.only("Admin can approve a rejected service type directly", async () => {
      await setupScenario(async (alice, bob) => {
        // Access the requests_and_offers DNA cells by role name
        const aliceRequestsAndOffers = alice.namedCells.get(
          "requests_and_offers",
        )!;
        const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "Service to Reject then Approve",
          }),
        };
        const suggestion = await suggestServiceType(
          bobRequestsAndOffers,
          serviceTypeInput,
        );
        const serviceTypeHash = suggestion.signed_action.hashed.hash;

        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        // First reject the service type
        await rejectServiceType(aliceRequestsAndOffers, serviceTypeHash);
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        // Verify it's in rejected state
        const rejectedBefore = await getRejectedServiceTypes(
          aliceRequestsAndOffers,
        );
        assert.equal(
          rejectedBefore.filter(
            (r) =>
              r.signed_action.hashed.hash.toString() ===
              serviceTypeHash.toString(),
          ).length,
          1,
        );

        // Now approve it directly from rejected state
        await approveServiceType(aliceRequestsAndOffers, serviceTypeHash);
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        // Verify it's now in approved state
        const approvedAfter = await getApprovedServiceTypes(
          aliceRequestsAndOffers,
        );
        assert.equal(
          approvedAfter.filter(
            (r) =>
              r.signed_action.hashed.hash.toString() ===
              serviceTypeHash.toString(),
          ).length,
          1,
        );

        // Verify it's no longer in rejected state
        const rejectedAfter = await getRejectedServiceTypes(
          aliceRequestsAndOffers,
        );
        assert.equal(
          rejectedAfter.filter(
            (r) =>
              r.signed_action.hashed.hash.toString() ===
              serviceTypeHash.toString(),
          ).length,
          0,
        );

        // Verify isServiceTypeApproved returns true
        const isApproved = await isServiceTypeApproved(
          aliceRequestsAndOffers,
          serviceTypeHash,
        );
        assert.isTrue(isApproved);
      });
    });

    test("Admin can delete a rejected service type", async () => {
      await setupScenario(async (alice, bob) => {
        // Access the requests_and_offers DNA cells by role name
        const aliceRequestsAndOffers = alice.namedCells.get(
          "requests_and_offers",
        )!;
        const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "Service to Reject then Delete",
          }),
        };
        const suggestion = await suggestServiceType(
          bobRequestsAndOffers,
          serviceTypeInput,
        );
        const serviceTypeHash = suggestion.signed_action.hashed.hash;

        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        // First reject the service type
        await rejectServiceType(aliceRequestsAndOffers, serviceTypeHash);
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        // Verify it's in rejected state
        const rejectedBefore = await getRejectedServiceTypes(
          aliceRequestsAndOffers,
        );
        assert.equal(
          rejectedBefore.filter(
            (r) =>
              r.signed_action.hashed.hash.toString() ===
              serviceTypeHash.toString(),
          ).length,
          1,
        );

        // Now delete the rejected service type
        await deleteServiceType(aliceRequestsAndOffers, serviceTypeHash);
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        // Verify it's no longer in rejected state
        const rejectedAfter = await getRejectedServiceTypes(
          aliceRequestsAndOffers,
        );
        assert.equal(
          rejectedAfter.filter(
            (r) =>
              r.signed_action.hashed.hash.toString() ===
              serviceTypeHash.toString(),
          ).length,
          0,
        );

        // Verify it's not in approved state either
        const approvedAfter = await getApprovedServiceTypes(
          aliceRequestsAndOffers,
        );
        assert.equal(
          approvedAfter.filter(
            (r) =>
              r.signed_action.hashed.hash.toString() ===
              serviceTypeHash.toString(),
          ).length,
          0,
        );
      });
    });
  });

  describe("Access Control", () => {
    test("Non-admin cannot moderate service types", async () => {
      await runScenarioWithTwoAgents(async (_scenario, alice, bob) => {
        // Access the requests_and_offers DNA cells by role name
        const aliceRequestsAndOffers = alice.namedCells.get(
          "requests_and_offers",
        )!;
        const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

        // No admin is registered in this scenario
        await createUser(aliceRequestsAndOffers, sampleUser({ name: "Alice" }));
        await createUser(bobRequestsAndOffers, sampleUser({ name: "Bob" }));
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "Unauthorized Moderation Test",
          }),
        };
        const suggestion = await suggestServiceType(
          bobRequestsAndOffers,
          serviceTypeInput,
        );
        const serviceTypeHash = suggestion.signed_action.hashed.hash;
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        // Alice (non-admin) tries to approve
        await expect(
          approveServiceType(aliceRequestsAndOffers, serviceTypeHash),
        ).rejects.toThrow(/Unauthorized/);

        // Bob (non-admin) tries to reject
        await expect(
          rejectServiceType(bobRequestsAndOffers, serviceTypeHash),
        ).rejects.toThrow(/Unauthorized/);

        // Non-admin trying to get pending service types should also fail
        await expect(
          getPendingServiceTypes(aliceRequestsAndOffers),
        ).rejects.toThrow(/Unauthorized/);

        // Service type should still be in the system (can verify with approved list which is public)
        const approvedList = await getApprovedServiceTypes(
          aliceRequestsAndOffers,
        );
        // It should not be in approved list since it was never approved
        const foundInApproved = approvedList.some(
          (r) =>
            r.signed_action.hashed.hash.toString() ===
            serviceTypeHash.toString(),
        );
        assert.isFalse(
          foundInApproved,
          "Service type should not be in approved list",
        );
      });
    });
  });
});
