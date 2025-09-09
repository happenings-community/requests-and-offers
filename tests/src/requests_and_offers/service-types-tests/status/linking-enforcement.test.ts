import { assert, test, describe } from "vitest";
import { Player, PlayerApp, dhtSync } from "@holochain/tryorama";
import { runScenarioWithTwoAgents } from "../../utils";
import { createUser, sampleUser } from "../../users/common";
import { registerNetworkAdministrator } from "../../administration/common";
import {
  ServiceTypeInput,
  createServiceType,
  linkToServiceType,
} from "../common";
import {
  suggestServiceType,
  rejectServiceType,
  rejectApprovedServiceType,
  sampleServiceTypeForStatus,
} from "./common";
import { createRequest, sampleRequest } from "../../requests-tests/common";
import { createOffer, sampleOffer } from "../../offers-tests/common";

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

describe("Service Type Linking Enforcement", () => {
  describe("Approved Service Types", () => {
    test("Can be linked to requests and offers", async () => {
      await setupScenario(async (alice, bob) => {
        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "Approved Service",
          }),
        };
        const serviceTypeRecord = await createServiceType(
          aliceRequestsAndOffers,
          serviceTypeInput,
        );
        const serviceTypeHash = serviceTypeRecord.signed_action.hashed.hash;

        const requestRecord = await createRequest(
          bobRequestsAndOffers,
          sampleRequest({}),
        );
        const offerRecord = await createOffer(
          bobRequestsAndOffers,
          sampleOffer({}),
        );
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        // Link to request
        await linkToServiceType(bobRequestsAndOffers, {
          service_type_hash: serviceTypeHash,
          action_hash: requestRecord.signed_action.hashed.hash,
          entity: "request",
        });

        // Link to offer
        await linkToServiceType(bobRequestsAndOffers, {
          service_type_hash: serviceTypeHash,
          action_hash: offerRecord.signed_action.hashed.hash,
          entity: "offer",
        });

        // If we reach here, the links were created successfully
        assert.ok(true);
      });
    });
  });

  describe("Pending Service Types", () => {
    test("Cannot be linked to requests or offers", async () => {
      await setupScenario(async (alice, bob) => {
        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "Pending Service",
          }),
        };
        const pendingServiceType = await suggestServiceType(
          bobRequestsAndOffers,
          serviceTypeInput,
        );
        const pendingHash = pendingServiceType.signed_action.hashed.hash;

        const requestRecord = await createRequest(
          bobRequestsAndOffers,
          sampleRequest({}),
        );
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        try {
          await linkToServiceType(bobRequestsAndOffers, {
            service_type_hash: pendingHash,
            action_hash: requestRecord.signed_action.hashed.hash,
            entity: "request",
          });
          assert.fail("Should not be able to link a pending service type");
        } catch (e) {
          assert.include(e.message, "not approved");
        }
      });
    });
  });

  describe("Rejected Service Types", () => {
    test("Cannot be linked to requests or offers", async () => {
      await setupScenario(async (alice, bob) => {
        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "Rejected Service",
          }),
        };
        const suggestion = await suggestServiceType(
          bobRequestsAndOffers,
          serviceTypeInput,
        );
        const serviceTypeHash = suggestion.signed_action.hashed.hash;
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        await rejectServiceType(aliceRequestsAndOffers, serviceTypeHash);
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        const offerRecord = await createOffer(
          bobRequestsAndOffers,
          sampleOffer({}),
        );
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        try {
          await linkToServiceType(bobRequestsAndOffers, {
            service_type_hash: serviceTypeHash,
            action_hash: offerRecord.signed_action.hashed.hash,
            entity: "offer",
          });
          assert.fail("Should not be able to link a rejected service type");
        } catch (e) {
          assert.include(e.message, "not approved");
        }
      });
    });

    test("Cannot be linked after being approved and then rejected", async () => {
      await setupScenario(async (alice, bob) => {
        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "Approved then Rejected",
          }),
        };
        const serviceTypeRecord = await createServiceType(
          aliceRequestsAndOffers,
          serviceTypeInput,
        );
        const serviceTypeHash = serviceTypeRecord.signed_action.hashed.hash;

        const requestRecord = await createRequest(
          bobRequestsAndOffers,
          sampleRequest({}),
        );
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        // Initially linkable
        await linkToServiceType(bobRequestsAndOffers, {
          service_type_hash: serviceTypeHash,
          action_hash: requestRecord.signed_action.hashed.hash,
          entity: "request",
        });

        // Now, admin rejects it
        await rejectApprovedServiceType(
          aliceRequestsAndOffers,
          serviceTypeHash,
        );
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

        // Try to link again (should fail)
        try {
          await linkToServiceType(bobRequestsAndOffers, {
            service_type_hash: serviceTypeHash,
            action_hash: requestRecord.signed_action.hashed.hash,
            entity: "request",
          });
          assert.fail("Should not be able to re-link a rejected service type");
        } catch (e) {
          assert.include(e.message, "not approved");
        }
      });
    });
  });
});
