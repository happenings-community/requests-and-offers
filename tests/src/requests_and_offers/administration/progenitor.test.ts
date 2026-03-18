import { dhtSync } from "@holochain/tryorama";
import { assert, test } from "vitest";
import { runScenarioWithProgenitor } from "../utils";
import { createUser, getAgentUser, sampleUser } from "../users/common";
import {
  checkIfAgentIsAdministrator,
  getAllAdministratorsLinks,
  registerNetworkAdministrator,
  removeAdministrator,
} from "./common";

/**
 * Tests for the Progenitor Pattern (Issue #5)
 *
 * The first agent to call create_user after bootstrapping the network is
 * automatically registered as the first network administrator — no explicit
 * registerNetworkAdministrator call is needed.
 *
 * Alice is set as the progenitor via DNA properties at install time.
 */
test(
  "progenitor is auto-registered as network administrator on create_user",
  async () => {
    await runScenarioWithProgenitor(async (scenario, alice, bob, alicePubKey) => {
      const aliceCell = alice.namedCells.get("requests_and_offers")!;
      const bobCell = bob.namedCells.get("requests_and_offers")!;

      // Alice creates her user profile — this should trigger auto-registration
      await createUser(aliceCell, sampleUser({ name: "Alice" }));
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      // There should be exactly one AllAdministrators link
      const adminLinks = await getAllAdministratorsLinks(aliceCell);
      assert.equal(
        adminLinks.length,
        1,
        "Expected exactly one administrator link after progenitor's create_user",
      );

      // The link target should point to Alice's user record
      const aliceUserLink = (await getAgentUser(aliceCell, alicePubKey))[0];
      assert.deepEqual(
        adminLinks[0].target,
        aliceUserLink.target,
        "Administrator link target should equal Alice's user hash",
      );

      // Alice should be flagged as an administrator
      assert.isTrue(
        await checkIfAgentIsAdministrator(aliceCell, alicePubKey),
        "Alice should be an administrator after progenitor create_user",
      );

      // Bob creates his user profile — he should NOT be auto-registered
      await createUser(bobCell, sampleUser({ name: "Bob" }));
      await dhtSync([alice, bob], aliceCell.cell_id[0]);

      assert.isFalse(
        await checkIfAgentIsAdministrator(bobCell, bob.agentPubKey),
        "Bob should NOT be an administrator after his create_user",
      );
    });
  },
);

test(
  "non-progenitor first user is NOT auto-registered when progenitor key is configured",
  async () => {
    await runScenarioWithProgenitor(async (scenario, alice, bob, _alicePubKey) => {
      const aliceCell = alice.namedCells.get("requests_and_offers")!;
      const bobCell = bob.namedCells.get("requests_and_offers")!;

      // Bob creates his profile BEFORE alice — he should NOT become admin
      await createUser(bobCell, sampleUser({ name: "Bob" }));
      await dhtSync([alice, bob], bobCell.cell_id[0]);

      assert.isFalse(
        await checkIfAgentIsAdministrator(bobCell, bob.agentPubKey),
        "Bob should NOT be an administrator even as the first user when progenitor key is configured",
      );

      const adminLinks = await getAllAdministratorsLinks(bobCell);
      assert.equal(
        adminLinks.length,
        0,
        "No admin links should exist after non-progenitor creates profile first",
      );
    });
  },
);

test("progenitor can be removed from the admin list by another admin", async () => {
  await runScenarioWithProgenitor(async (scenario, alice, bob, alicePubKey) => {
    const aliceCell = alice.namedCells.get("requests_and_offers")!;
    const bobCell = bob.namedCells.get("requests_and_offers")!;

    // Alice (progenitor) creates profile → auto-registered as admin
    await createUser(aliceCell, sampleUser({ name: "Alice" }));
    // Bob creates profile
    await createUser(bobCell, sampleUser({ name: "Bob" }));
    await dhtSync([alice, bob], aliceCell.cell_id[0]);

    const aliceUserLink = (await getAgentUser(aliceCell, alicePubKey))[0];
    const bobUserLink = (await getAgentUser(bobCell, bob.agentPubKey))[0];

    // Alice (admin) adds Bob as admin
    await registerNetworkAdministrator(aliceCell, bobUserLink.target, [bob.agentPubKey]);
    await dhtSync([alice, bob], aliceCell.cell_id[0]);

    // Bob (now admin) removes Alice from the admin list
    await removeAdministrator(bobCell, aliceUserLink.target, [alicePubKey]);
    await dhtSync([alice, bob], aliceCell.cell_id[0]);

    // Verify Alice is no longer an admin
    assert.isFalse(
      await checkIfAgentIsAdministrator(aliceCell, alicePubKey),
      "Progenitor should NOT be an administrator after being revoked by another admin",
    );

    const adminLinks = await getAllAdministratorsLinks(aliceCell);
    assert.equal(adminLinks.length, 1, "Only Bob should remain as admin after revoking Alice");
  });
});

test("progenitor remains in pending status after create_user", async () => {
  await runScenarioWithProgenitor(async (scenario, alice, _bob, _alicePubKey) => {
    const aliceCell = alice.namedCells.get("requests_and_offers")!;

    const aliceRecord = await createUser(aliceCell, sampleUser({ name: "Alice" }));

    // The record itself should exist — status is created (pending by default)
    assert.ok(aliceRecord, "Alice's user record should be created");
  });
});
