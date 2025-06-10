import { assert, test, describe } from "vitest";
import { Player, dhtSync } from "@holochain/tryorama";
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
  callback: (alice: Player, bob: Player) => Promise<void>
) {
  await runScenarioWithTwoAgents(async (_scenario, alice, bob) => {
    const aliceUser = sampleUser({ name: "Alice" });
    const bobUser = sampleUser({ name: "Bob" });

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

describe("Service Type Linking Enforcement", () => {
  describe("Approved Service Types", () => {
    test(
      "Can be linked to requests and offers",
      async () => {
        await setupScenario(async (alice, bob) => {
          const serviceTypeInput: ServiceTypeInput = {
            service_type: sampleServiceTypeForStatus({
              name: "Approved Service",
            }),
          };
          const serviceTypeRecord = await createServiceType(
            alice.cells[0],
            serviceTypeInput
          );
          const serviceTypeHash = serviceTypeRecord.signed_action.hashed.hash;

          const requestRecord = await createRequest(
            bob.cells[0],
            sampleRequest({})
          );
          const offerRecord = await createOffer(bob.cells[0], sampleOffer({}));
          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          // Link to request
          await linkToServiceType(bob.cells[0], {
            service_type_hash: serviceTypeHash,
            action_hash: requestRecord.signed_action.hashed.hash,
            entity: "request",
          });

          // Link to offer
          await linkToServiceType(bob.cells[0], {
            service_type_hash: serviceTypeHash,
            action_hash: offerRecord.signed_action.hashed.hash,
            entity: "offer",
          });

          // If we reach here, the links were created successfully
          assert.ok(true);
        });
      },
      { timeout: 180000 }
    );
  });

  describe("Pending Service Types", () => {
    test(
      "Cannot be linked to requests or offers",
      async () => {
        await setupScenario(async (alice, bob) => {
          const serviceTypeInput: ServiceTypeInput = {
            service_type: sampleServiceTypeForStatus({
              name: "Pending Service",
            }),
          };
          const pendingServiceType = await suggestServiceType(
            bob.cells[0],
            serviceTypeInput
          );
          const pendingHash = pendingServiceType.signed_action.hashed.hash;

          const requestRecord = await createRequest(
            bob.cells[0],
            sampleRequest({})
          );
          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          try {
            await linkToServiceType(bob.cells[0], {
              service_type_hash: pendingHash,
              action_hash: requestRecord.signed_action.hashed.hash,
              entity: "request",
            });
            assert.fail("Should not be able to link a pending service type");
          } catch (e) {
            assert.include(e.message, "not approved");
          }
        });
      },
      { timeout: 180000 }
    );
  });

  describe("Rejected Service Types", () => {
    test(
      "Cannot be linked to requests or offers",
      async () => {
        await setupScenario(async (alice, bob) => {
          const serviceTypeInput: ServiceTypeInput = {
            service_type: sampleServiceTypeForStatus({
              name: "Rejected Service",
            }),
          };
          const suggestion = await suggestServiceType(
            bob.cells[0],
            serviceTypeInput
          );
          const serviceTypeHash = suggestion.signed_action.hashed.hash;
          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          await rejectServiceType(alice.cells[0], serviceTypeHash);
          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          const offerRecord = await createOffer(bob.cells[0], sampleOffer({}));
          await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

          try {
            await linkToServiceType(bob.cells[0], {
              service_type_hash: serviceTypeHash,
              action_hash: offerRecord.signed_action.hashed.hash,
              entity: "offer",
            });
            assert.fail("Should not be able to link a rejected service type");
          } catch (e) {
            assert.include(e.message, "not approved");
          }
        });
      },
      { timeout: 180000 }
    );

    test("Cannot be linked after being approved and then rejected", async () => {
      await setupScenario(async (alice, bob) => {
        const serviceTypeInput: ServiceTypeInput = {
          service_type: sampleServiceTypeForStatus({
            name: "Approved then Rejected",
          }),
        };
        const serviceTypeRecord = await createServiceType(
          alice.cells[0],
          serviceTypeInput
        );
        const serviceTypeHash = serviceTypeRecord.signed_action.hashed.hash;

        const requestRecord = await createRequest(
          bob.cells[0],
          sampleRequest({})
        );
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Initially linkable
        await linkToServiceType(bob.cells[0], {
          service_type_hash: serviceTypeHash,
          action_hash: requestRecord.signed_action.hashed.hash,
          entity: "request",
        });

        // Now, admin rejects it
        await rejectApprovedServiceType(alice.cells[0], serviceTypeHash);
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Try to link again (should fail)
        try {
          await linkToServiceType(bob.cells[0], {
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
