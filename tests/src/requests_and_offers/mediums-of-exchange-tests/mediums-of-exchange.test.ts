import { assert, expect, test } from "vitest";
import { Scenario, dhtSync } from "@holochain/tryorama";
import { ActionHash, Record } from "@holochain/client";
import { decode } from "@msgpack/msgpack";
import { runScenarioWithTwoAgents } from "../utils";

type Player = any; // Using same type as other tests
import { createUser, sampleUser } from "../users/common";
import { registerNetworkAdministrator } from "../administration/common";
import {
  suggestMediumOfExchange,
  getMediumOfExchange,
  getAllMediumsOfExchange,
  getPendingMediumsOfExchange,
  getApprovedMediumsOfExchange,
  getRejectedMediumsOfExchange,
  approveMediumOfExchange,
  rejectMediumOfExchange,
  sampleMediumOfExchange,
  MediumOfExchange,
  MediumOfExchangeInput,
} from "./common";

// Test for basic MediumOfExchange workflow
test(
  "basic MediumOfExchange suggestion and approval workflow",
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

        // Test suggesting a medium of exchange (Bob as accepted user)
        const mediumOfExchange = sampleMediumOfExchange({
          code: "EUR",
          name: "Euro",
        });

        const mediumOfExchangeInput: MediumOfExchangeInput = {
          medium_of_exchange: mediumOfExchange,
        };

        const mediumOfExchangeRecord: Record = await suggestMediumOfExchange(
          bob.cells[0],
          mediumOfExchangeInput
        );
        assert.ok(mediumOfExchangeRecord);

        const decodedMediumOfExchange = decode(
          (mediumOfExchangeRecord.entry as any).Present.entry
        ) as MediumOfExchange;
        assert.equal(decodedMediumOfExchange.code, "EUR");
        assert.equal(decodedMediumOfExchange.name, "Euro");
        assert.equal(decodedMediumOfExchange.resource_spec_hrea_id, null);

        // Sync after creating medium of exchange
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test getting all mediums of exchange
        const allMediumsOfExchange: Record[] = await getAllMediumsOfExchange(
          alice.cells[0]
        );
        assert.lengthOf(allMediumsOfExchange, 1);

        // Test getting pending mediums of exchange (admin only)
        const pendingMediumsOfExchange: Record[] =
          await getPendingMediumsOfExchange(alice.cells[0]);
        assert.lengthOf(pendingMediumsOfExchange, 1);

        // Test that Bob cannot access pending mediums of exchange (not admin)
        await expect(
          getPendingMediumsOfExchange(bob.cells[0])
        ).rejects.toThrow();

        // Test getting a specific medium of exchange
        const retrievedMediumOfExchange: Record | null =
          await getMediumOfExchange(
            alice.cells[0],
            mediumOfExchangeRecord.signed_action.hashed.hash
          );
        assert.ok(retrievedMediumOfExchange);
        const retrievedDecoded = decode(
          (retrievedMediumOfExchange.entry as any).Present.entry
        ) as MediumOfExchange;
        assert.deepEqual(retrievedDecoded, decodedMediumOfExchange);

        // Test approving the medium of exchange (Alice as admin)
        await approveMediumOfExchange(
          alice.cells[0],
          mediumOfExchangeRecord.signed_action.hashed.hash
        );

        // Sync after approval
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test getting approved mediums of exchange
        const approvedMediumsOfExchange: Record[] =
          await getApprovedMediumsOfExchange(alice.cells[0]);
        assert.lengthOf(approvedMediumsOfExchange, 1);

        // Verify pending list is now empty
        const pendingAfterApproval: Record[] =
          await getPendingMediumsOfExchange(alice.cells[0]);
        assert.lengthOf(pendingAfterApproval, 0);

        // Verify the approved medium has hREA resource spec ID
        const approvedMedium = decode(
          (approvedMediumsOfExchange[0].entry as any).Present.entry
        ) as MediumOfExchange;
        assert.ok(approvedMedium.resource_spec_hrea_id);
        assert.equal(
          approvedMedium.resource_spec_hrea_id,
          "hrea_resource_spec_EUR"
        );
      }
    );
  },
  {
    timeout: 180000, // 3 minutes
  }
);

// Test for rejection workflow
test(
  "MediumOfExchange rejection workflow",
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

        // Test suggesting a medium of exchange (Bob as accepted user)
        const mediumOfExchange = sampleMediumOfExchange({
          code: "FAKE",
          name: "Fake Currency",
        });

        const mediumOfExchangeInput: MediumOfExchangeInput = {
          medium_of_exchange: mediumOfExchange,
        };

        const mediumOfExchangeRecord: Record = await suggestMediumOfExchange(
          bob.cells[0],
          mediumOfExchangeInput
        );
        assert.ok(mediumOfExchangeRecord);

        // Sync after creating medium of exchange
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test rejecting the medium of exchange (Alice as admin)
        await rejectMediumOfExchange(
          alice.cells[0],
          mediumOfExchangeRecord.signed_action.hashed.hash
        );

        // Sync after rejection
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test getting rejected mediums of exchange (admin only)
        const rejectedMediumsOfExchange: Record[] =
          await getRejectedMediumsOfExchange(alice.cells[0]);
        assert.lengthOf(rejectedMediumsOfExchange, 1);

        // Verify pending list is now empty
        const pendingAfterRejection: Record[] =
          await getPendingMediumsOfExchange(alice.cells[0]);
        assert.lengthOf(pendingAfterRejection, 0);

        // Verify approved list is empty
        const approvedAfterRejection: Record[] =
          await getApprovedMediumsOfExchange(alice.cells[0]);
        assert.lengthOf(approvedAfterRejection, 0);

        // Test that Bob cannot access rejected mediums of exchange (not admin)
        await expect(
          getRejectedMediumsOfExchange(bob.cells[0])
        ).rejects.toThrow();
      }
    );
  },
  {
    timeout: 180000, // 3 minutes
  }
);

// Test for validation
test(
  "MediumOfExchange validation",
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

        // Sync after setup
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test validation - empty code should fail
        const invalidMediumOfExchangeInput1: MediumOfExchangeInput = {
          medium_of_exchange: sampleMediumOfExchange({
            code: "",
            name: "Valid Name",
          }),
        };

        await expect(
          suggestMediumOfExchange(bob.cells[0], invalidMediumOfExchangeInput1)
        ).rejects.toThrow();

        // Test validation - empty name should fail
        const invalidMediumOfExchangeInput2: MediumOfExchangeInput = {
          medium_of_exchange: sampleMediumOfExchange({
            code: "VALID",
            name: "",
          }),
        };

        await expect(
          suggestMediumOfExchange(bob.cells[0], invalidMediumOfExchangeInput2)
        ).rejects.toThrow();
      }
    );
  },
  {
    timeout: 180000, // 3 minutes
  }
);

// Test for authorization
test(
  "MediumOfExchange authorization",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        // Create user for Alice only (Bob will not be an accepted user)
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
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test that Bob (not an accepted user) cannot suggest a medium of exchange
        const mediumOfExchange = sampleMediumOfExchange({
          code: "TEST",
          name: "Test Currency",
        });

        const mediumOfExchangeInput: MediumOfExchangeInput = {
          medium_of_exchange: mediumOfExchange,
        };

        await expect(
          suggestMediumOfExchange(bob.cells[0], mediumOfExchangeInput)
        ).rejects.toThrow();

        // Create a valid suggestion from Alice (who is an accepted user)
        const validRecord = await suggestMediumOfExchange(
          alice.cells[0],
          mediumOfExchangeInput
        );
        assert.ok(validRecord);

        // Sync
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test that Bob (not admin) cannot approve
        await expect(
          approveMediumOfExchange(
            bob.cells[0],
            validRecord.signed_action.hashed.hash
          )
        ).rejects.toThrow();

        // Test that Bob (not admin) cannot reject
        await expect(
          rejectMediumOfExchange(
            bob.cells[0],
            validRecord.signed_action.hashed.hash
          )
        ).rejects.toThrow();
      }
    );
  },
  {
    timeout: 180000, // 3 minutes
  }
);
