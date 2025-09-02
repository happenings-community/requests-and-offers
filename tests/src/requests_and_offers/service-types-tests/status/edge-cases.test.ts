import { assert, expect, test, describe } from "vitest";
import { Player, PlayerApp, dhtSync } from "@holochain/tryorama";
import { ActionHash, Record } from "@holochain/client";
import { runScenarioWithTwoAgents } from "../../utils";
import { createUser, sampleUser } from "../../users/common";
import { registerNetworkAdministrator } from "../../administration/common";
import { ServiceTypeInput } from "../common";
import {
  suggestServiceType,
  getPendingServiceTypes,
  getApprovedServiceTypes,
  getRejectedServiceTypes,
  approveServiceType,
  rejectServiceType,
  sampleServiceTypeForStatus,
  rejectApprovedServiceType,
} from "./common";

// Helper function to set up a scenario with an admin and a regular user
async function setupScenario(
  callback: (alice: PlayerApp, bob: PlayerApp) => Promise<void>,
) {
  await runScenarioWithTwoAgents(async (_scenario, alice, bob) => {
    const aliceUser = sampleUser({ name: "Alice" });
    const bobUser = sampleUser({ name: "Bob" });

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

describe("Service Type Status Edge Cases", () => {
  describe("Idempotency", () => {
    test("Approving an already approved service type fails gracefully", async () => {
      await setupScenario(async (alice, bob) => {
        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "Idempotent Approval",
          }),
        };
        const suggestion = await suggestServiceType(
          bobRequestsAndOffers,
          serviceTypeInput,
        );
        const serviceTypeHash = suggestion.signed_action.hashed.hash;
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        // First approval
        await approveServiceType(aliceRequestsAndOffers, serviceTypeHash);
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        // Second approval should fail since it's no longer pending
        await expect(
          approveServiceType(aliceRequestsAndOffers, serviceTypeHash),
        ).rejects.toThrow(/Service type is not pending/);

        // Verify it's still in approved list exactly once
        const approvedTypes = await getApprovedServiceTypes(aliceRequestsAndOffers);
        const matchingRecords = approvedTypes.filter(
          (record) =>
            record.signed_action.hashed.hash.toString() ===
            serviceTypeHash.toString(),
        );
        assert.equal(
          matchingRecords.length,
          1,
          "Service type should appear exactly once in approved list",
        );
      });
    });

    test("Rejecting an already rejected service type fails gracefully", async () => {
      await setupScenario(async (alice, bob) => {
        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "Idempotent Rejection",
          }),
        };
        const suggestion = await suggestServiceType(
          bobRequestsAndOffers,
          serviceTypeInput,
        );
        const serviceTypeHash = suggestion.signed_action.hashed.hash;
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        // First rejection
        await rejectServiceType(aliceRequestsAndOffers, serviceTypeHash);
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        // Second rejection should fail since it's no longer pending
        await expect(
          rejectServiceType(aliceRequestsAndOffers, serviceTypeHash),
        ).rejects.toThrow(/Service type is not pending/);

        // Verify it's still in rejected list exactly once
        const rejectedTypes = await getRejectedServiceTypes(aliceRequestsAndOffers);
        const matchingRecords = rejectedTypes.filter(
          (record) =>
            record.signed_action.hashed.hash.toString() ===
            serviceTypeHash.toString(),
        );
        assert.equal(
          matchingRecords.length,
          1,
          "Service type should appear exactly once in rejected list",
        );
      });
    });
  });

  describe("State Exclusivity", () => {
    test("Service type cannot be in multiple status lists simultaneously", async () => {
      await setupScenario(async (alice, bob) => {
        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "State Exclusivity Test",
          }),
        };
        const suggestion = await suggestServiceType(
          bobRequestsAndOffers,
          serviceTypeInput,
        );
        const serviceTypeHash = suggestion.signed_action.hashed.hash;
        const serviceTypeHashStr = serviceTypeHash.toString();
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        const isPresent = async (
          getter: (cell: PlayerApp["cells"][number]) => Promise<Record[]>,
        ) => {
          const list = await getter(aliceRequestsAndOffers);
          return list.some(
            (r) =>
              r.signed_action.hashed.hash.toString() === serviceTypeHashStr,
          );
        };

        // Initially, it should only be in the pending list
        assert.isTrue(
          await isPresent(getPendingServiceTypes),
          "Should be in pending list",
        );
        assert.isFalse(
          await isPresent(getApprovedServiceTypes),
          "Should not be in approved list",
        );
        assert.isFalse(
          await isPresent(getRejectedServiceTypes),
          "Should not be in rejected list",
        );

        // After approval, it should only be in the approved list
        await approveServiceType(aliceRequestsAndOffers, serviceTypeHash);
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);
        assert.isFalse(
          await isPresent(getPendingServiceTypes),
          "Should not be in pending list after approval",
        );
        assert.isTrue(
          await isPresent(getApprovedServiceTypes),
          "Should be in approved list after approval",
        );
        assert.isFalse(
          await isPresent(getRejectedServiceTypes),
          "Should not be in rejected list after approval",
        );

        // After rejection (using the reject_approved_service_type function), it should only be in the rejected list
        await rejectApprovedServiceType(aliceRequestsAndOffers, serviceTypeHash);
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);
        assert.isFalse(
          await isPresent(getPendingServiceTypes),
          "Should not be in pending list after rejection",
        );
        assert.isFalse(
          await isPresent(getApprovedServiceTypes),
          "Should not be in approved list after rejection",
        );
        assert.isTrue(
          await isPresent(getRejectedServiceTypes),
          "Should be in rejected list after rejection",
        );
      });
    });
  });

  describe("Error Handling", () => {
    test("Attempting to approve or reject a non-existent service type hash fails", async () => {
      await setupScenario(async (alice, _bob) => {
        // Create a fake hash that does not correspond to any entry.
        // An ActionHash is a 39-byte Uint8Array.
        const fakeHash: ActionHash = new Uint8Array(39).fill(1);

        // The actual error might be a deserialization error rather than "Entry not found"
        await expect(
          approveServiceType(aliceRequestsAndOffers, fakeHash),
        ).rejects.toThrow();

        await expect(
          rejectServiceType(aliceRequestsAndOffers, fakeHash),
        ).rejects.toThrow();
      });
    });
  });
});
