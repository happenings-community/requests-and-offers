import { assert, test } from "vitest";
import { runScenarioWithTwoAgents } from "../utils";
import { sampleUser, createUser } from "../users/common";

/**
 * CRITICAL TEST: Validates namedCells solution for multi-DNA Tryorama tests
 * 
 * This test proves that alice.namedCells.get("role_name") is the reliable way
 * to access specific DNA cells, eliminating the unreliable alice.cells[0] pattern
 * that causes flaky tests due to non-deterministic DNA ordering.
 */
test("namedCells solution - reliable multi-DNA cell access", async () => {
  await runScenarioWithTwoAgents(async (scenario, alice, bob) => {
    console.log("🧪 Testing namedCells solution for multi-DNA reliability...");

    // STEP 1: Verify namedCells Map exists and has expected keys
    console.log("📋 Available namedCells for Alice:", Array.from(alice.namedCells.keys()));
    console.log("📋 Available namedCells for Bob:", Array.from(bob.namedCells.keys()));

    assert.ok(alice.namedCells, "Alice should have namedCells Map");
    assert.ok(bob.namedCells, "Bob should have namedCells Map");
    assert.ok(alice.namedCells.has("requests_and_offers"), "Alice namedCells should contain 'requests_and_offers'");
    assert.ok(bob.namedCells.has("requests_and_offers"), "Bob namedCells should contain 'requests_and_offers'");

    // STEP 2: Access cells by role name (the RELIABLE approach)
    const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers");
    const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers");
    const aliceHREA = alice.namedCells.get("hrea");
    const bobHREA = bob.namedCells.get("hrea");

    // STEP 3: Verify we got the expected cells
    assert.ok(aliceRequestsAndOffers, "Alice should have requests_and_offers cell");
    assert.ok(bobRequestsAndOffers, "Bob should have requests_and_offers cell");
    assert.ok(aliceHREA, "Alice should have hrea cell");
    assert.ok(bobHREA, "Bob should have hrea cell");

    console.log("✅ Successfully accessed all cells via namedCells");
    console.log(`📍 Alice requests_and_offers cell: ${aliceRequestsAndOffers!.cell_id[0]}`);
    console.log(`📍 Alice hrea cell: ${aliceHREA!.cell_id[0]}`);

    // STEP 4: Verify cells are actually different (proving we got the right ones)
    assert.notEqual(
      aliceRequestsAndOffers!.cell_id[0].toString(),
      aliceHREA!.cell_id[0].toString(),
      "requests_and_offers and hrea cells should be different"
    );

    // STEP 5: Test zome calls to prove we have the correct DNAs
    console.log("🔧 Testing zome calls to verify correct DNA access...");

    // Test requests_and_offers DNA - should have "misc" zome
    const pingResult = await aliceRequestsAndOffers!.callZome({
      zome_name: "misc", 
      fn_name: "ping",
    });
    assert.equal(pingResult, "Pong", "requests_and_offers DNA should respond to misc.ping()");
    console.log("✅ requests_and_offers DNA: misc.ping() works");

    // Test that we can create a user (users zome exists in requests_and_offers DNA)
    const sample = sampleUser({ name: "namedCells Test User" });
    const userRecord = await createUser(aliceRequestsAndOffers!, sample);
    assert.ok(userRecord, "Should be able to create user via requests_and_offers DNA");
    console.log("✅ requests_and_offers DNA: users zome works");

    // STEP 6: Compare with old unreliable approach (for educational purposes)
    console.log("⚠️  Demonstrating why alice.cells[0] is unreliable:");
    console.log(`📍 alice.cells[0]: ${alice.cells[0].cell_id[0]}`);
    console.log(`📍 alice.cells[1]: ${alice.cells[1].cell_id[0]}`);
    console.log(`📍 namedCells requests_and_offers: ${aliceRequestsAndOffers!.cell_id[0]}`);
    console.log(`📍 namedCells hrea: ${aliceHREA!.cell_id[0]}`);

    // Show that cells[0] might not match namedCells.get("requests_and_offers")
    const cells0MatchesRequestsAndOffers = alice.cells[0].cell_id[0].toString() === 
                                          aliceRequestsAndOffers!.cell_id[0].toString();
    console.log(`🎯 cells[0] matches requests_and_offers: ${cells0MatchesRequestsAndOffers}`);
    
    if (!cells0MatchesRequestsAndOffers) {
      console.log("🚨 PROOF: cells[0] is NOT requests_and_offers DNA - this would cause test failures!");
    }

    console.log("🎉 namedCells solution validated successfully!");
  });
});