// TODO(#102): This file has been migrated to Rust Sweettest in tests/sweettest/.
// It will be removed in a follow-up cleanup PR once the migration is verified.

import { dhtSync } from "@holochain/tryorama";
import { assert, test } from "vitest";
import { runScenarioWithProgenitor } from "../utils";
import {
  User,
  createUser,
  getAgentUser,
  getUserAgents,
  sampleUser,
} from "../users/common";
import {
  checkIfAgentIsAdministrator,
  checkIfEntityIsAdministrator,
  getAllAdministratorsLinks,
  registerNetworkAdministrator,
  removeAdministrator,
} from "./common";

/**
 * FOCUSED TEST: Administrator Management
 * Tests the core administrator registration and removal functionality.
 * Uses runScenarioWithProgenitor so alice is auto-registered as the first
 * administrator via create_user (progenitor pattern) — no manual bootstrap.
 */
test("register and remove network administrator", async () => {
  await runScenarioWithProgenitor(async (scenario, alice, bob, _alicePubKey) => {
    // Access the requests_and_offers DNA cells by role name
    const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
    const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

    // Create users — alice is auto-registered as network admin (progenitor pattern)
    let sample = sampleUser({ name: "Alice" });
    await createUser(aliceRequestsAndOffers, sample);
    sample = sampleUser({ name: "Bob" });
    await createUser(bobRequestsAndOffers, sample);
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    const aliceUserLink = (
      await getAgentUser(aliceRequestsAndOffers, alice.agentPubKey)
    )[0];
    const bobUserLink = (
      await getAgentUser(bobRequestsAndOffers, bob.agentPubKey)
    )[0];

    const administrators = await getAllAdministratorsLinks(
      aliceRequestsAndOffers,
    );

    // Verify that there is one administrator
    assert.equal(administrators.length, 1);

    // Verify that the link target is Alice
    assert.equal(
      administrators[0].target.toString(),
      aliceUserLink.target.toString(),
    );

    // Verify that Alice is an administrator
    assert.ok(
      await checkIfEntityIsAdministrator(
        aliceRequestsAndOffers,
        aliceUserLink.target,
      ),
    );

    // Verify that Bob is not an administrator
    assert.notOk(
      await checkIfEntityIsAdministrator(
        bobRequestsAndOffers,
        bobUserLink.target,
      ),
    );

    // Verify that Alice is an administrator with her AgentPubKey
    assert.ok(
      await checkIfAgentIsAdministrator(
        aliceRequestsAndOffers,
        alice.agentPubKey,
      ),
    );

    // Verify that Bob is not an administrator with his AgentPubKey
    assert.notOk(
      await checkIfAgentIsAdministrator(bobRequestsAndOffers, bob.agentPubKey),
    );

    // Alice adds Bob as an administrator and then removes him
    const bobAgents = await getUserAgents(
      bobRequestsAndOffers,
      bobUserLink.target,
    );

    await registerNetworkAdministrator(
      aliceRequestsAndOffers,
      bobUserLink.target,
      bobAgents,
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    assert.ok(
      await checkIfEntityIsAdministrator(
        bobRequestsAndOffers,
        bobUserLink.target,
      ),
    );

    await removeAdministrator(
      aliceRequestsAndOffers,
      bobUserLink.target,
      bobAgents,
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    assert.notOk(
      await checkIfEntityIsAdministrator(
        bobRequestsAndOffers,
        bobUserLink.target,
      ),
    );

    assert.notOk(
      await checkIfAgentIsAdministrator(bobRequestsAndOffers, bob.agentPubKey),
    );
  });
});
