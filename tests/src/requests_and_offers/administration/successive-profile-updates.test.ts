import { dhtSync } from "@holochain/tryorama";
import { assert, test } from "vitest";
import { decodeRecord, runScenarioWithTwoAgents } from "../utils";
import {
  User,
  createUser,
  getAgentUser,
  getLatestUser,
  sampleUser,
  updateUser,
} from "../users/common";

/**
 * FOCUSED TEST: Issue #57 - Successive Profile Updates
 * Tests that multiple profile updates in succession work correctly
 * by ensuring proper linking chains and DHT synchronization
 */
test("successive profile updates work correctly", async () => {
  await runScenarioWithTwoAgents(async (scenario, alice, bob) => {
    const aliceCell = alice.namedCells.get("requests_and_offers")!;
    const bobCell = bob.namedCells.get("requests_and_offers")!;

    console.log("🔍 Testing successive profile updates for Issue #57");

    // Create initial user
    const initialUser = sampleUser({
      name: "Initial User",
      bio: "Initial bio",
      email: "initial@test.com",
    });

    await createUser(bobCell, initialUser);
    await dhtSync([alice, bob], aliceCell.cell_id[0]);

    const bobUserLink = (await getAgentUser(bobCell, bob.agentPubKey))[0];
    console.log(
      `✅ Created user with original_action_hash: ${bobUserLink.target}`,
    );

    // ========================================
    // FIRST UPDATE - Should work
    // ========================================
    console.log("\n🔄 Performing FIRST profile update...");

    let currentRecord = await getLatestUser(bobCell, bobUserLink.target);
    console.log(
      `📋 First update - using previous_action_hash: ${currentRecord.signed_action.hashed.hash}`,
    );

    const firstUpdate = sampleUser({
      name: "First Update",
      bio: "First updated bio",
      email: "first.update@test.com",
    });

    await updateUser(
      bobCell,
      bobUserLink.target, // original_action_hash
      currentRecord.signed_action.hashed.hash, // previous_action_hash
      firstUpdate,
    );

    // CRITICAL: Ensure DHT sync completes
    await dhtSync([alice, bob], aliceCell.cell_id[0]);
    console.log("✅ First update completed and synced");

    // Verify first update worked
    let verifyRecord = await getLatestUser(aliceCell, bobUserLink.target);
    let verifyUser = decodeRecord(verifyRecord) as User;
    assert.equal(verifyUser.name, "First Update");
    assert.equal(verifyUser.bio, "First updated bio");
    console.log("✅ First update verification passed");

    // ========================================
    // SECOND UPDATE - This is where Issue #57 manifests
    // ========================================
    console.log("\n🔄 Performing SECOND profile update...");

    // Get the latest record (should be the first update)
    currentRecord = await getLatestUser(bobCell, bobUserLink.target);
    console.log(
      `📋 Second update - using previous_action_hash: ${currentRecord.signed_action.hashed.hash}`,
    );

    const secondUpdate = sampleUser({
      name: "Second Update",
      bio: "Second updated bio",
      email: "second.update@test.com",
    });

    await updateUser(
      bobCell,
      bobUserLink.target, // original_action_hash (same as before)
      currentRecord.signed_action.hashed.hash, // previous_action_hash (first update hash)
      secondUpdate,
    );

    // CRITICAL: Ensure DHT sync completes
    await dhtSync([alice, bob], aliceCell.cell_id[0]);
    console.log("✅ Second update completed and synced");

    // Verify second update worked - THIS IS WHERE ISSUE #57 FAILS
    verifyRecord = await getLatestUser(aliceCell, bobUserLink.target);
    verifyUser = decodeRecord(verifyRecord) as User;
    assert.equal(verifyUser.name, "Second Update");
    assert.equal(verifyUser.bio, "Second updated bio");
    assert.equal(verifyUser.email, "second.update@test.com");
    console.log("✅ Second update verification passed");

    // ========================================
    // THIRD UPDATE - Ensure chain continues
    // ========================================
    console.log("\n🔄 Performing THIRD profile update...");

    currentRecord = await getLatestUser(bobCell, bobUserLink.target);
    console.log(
      `📋 Third update - using previous_action_hash: ${currentRecord.signed_action.hashed.hash}`,
    );

    const thirdUpdate = sampleUser({
      name: "Third Update",
      bio: "Third updated bio",
      email: "third.update@test.com",
    });

    await updateUser(
      bobCell,
      bobUserLink.target, // original_action_hash (same as before)
      currentRecord.signed_action.hashed.hash, // previous_action_hash (second update hash)
      thirdUpdate,
    );

    await dhtSync([alice, bob], aliceCell.cell_id[0]);
    console.log("✅ Third update completed and synced");

    // Final verification
    verifyRecord = await getLatestUser(aliceCell, bobUserLink.target);
    verifyUser = decodeRecord(verifyRecord) as User;
    assert.equal(verifyUser.name, "Third Update");
    assert.equal(verifyUser.bio, "Third updated bio");
    assert.equal(verifyUser.email, "third.update@test.com");
    console.log("✅ Third update verification passed");

    console.log("\n🎉 All successive profile updates completed successfully!");
  });
});

/**
 * DEBUGGING TEST: Examine link structure after updates
 * This test helps debug the actual linking structure
 */
test("debug profile update links", async () => {
  await runScenarioWithTwoAgents(async (scenario, alice, bob) => {
    const aliceCell = alice.namedCells.get("requests_and_offers")!;
    const bobCell = bob.namedCells.get("requests_and_offers")!;

    console.log("🔍 Debugging profile update links");

    // Create user and perform updates
    const initialUser = sampleUser({ name: "Debug User" });
    await createUser(bobCell, initialUser);
    await dhtSync([alice, bob], aliceCell.cell_id[0]);

    const bobUserLink = (await getAgentUser(bobCell, bob.agentPubKey))[0];

    // First update
    let currentRecord = await getLatestUser(bobCell, bobUserLink.target);
    await updateUser(
      bobCell,
      bobUserLink.target,
      currentRecord.signed_action.hashed.hash,
      sampleUser({ name: "Debug Update 1" }),
    );
    await dhtSync([alice, bob], aliceCell.cell_id[0]);

    // Second update
    currentRecord = await getLatestUser(bobCell, bobUserLink.target);
    await updateUser(
      bobCell,
      bobUserLink.target,
      currentRecord.signed_action.hashed.hash,
      sampleUser({ name: "Debug Update 2" }),
    );
    await dhtSync([alice, bob], aliceCell.cell_id[0]);

    // TODO: Add link debugging calls here to examine the actual link structure
    // This will help identify if links are being created correctly

    console.log("🔍 Link debugging completed - check logs for link structure");
  });
});
