import { assert, test } from "vitest";
import { Scenario, Player } from "@holochain/tryorama";
import { runScenarioWithTwoAgents } from "../utils";

/**
 * Simple test to quickly identify the DNA ordering issue.
 * This test runs faster by avoiding complex zome function calls.
 */

test(
  "Simple DNA ordering identification test",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        console.log("=== SIMPLE DNA ORDERING ANALYSIS ===");
        
        console.log(`Alice has ${alice.cells.length} cells`);
        console.log(`Bob has ${bob.cells.length} cells`);
        
        // Check if both players have the expected number of cells (should be 2)
        assert.equal(alice.cells.length, 2, "Alice should have 2 cells (requests_and_offers + hrea)");
        assert.equal(bob.cells.length, 2, "Bob should have 2 cells (requests_and_offers + hrea)");
        
        // Get cell IDs to see if they're in the same order
        const aliceCellIds = alice.cells.map(cell => cell.cell_id[0].toString());
        const bobCellIds = bob.cells.map(cell => cell.cell_id[0].toString());
        
        console.log("\nCell ID comparison:");
        for (let i = 0; i < Math.min(aliceCellIds.length, bobCellIds.length); i++) {
          const aliceId = aliceCellIds[i].substring(0, 16) + "...";
          const bobId = bobCellIds[i].substring(0, 16) + "...";
          const match = aliceCellIds[i] === bobCellIds[i];
          console.log(`  Index ${i}: Alice(${aliceId}) vs Bob(${bobId}) - ${match ? '✅ Match' : '❌ Different'}`);
        }
        
        // Try to identify which DNA is which by attempting simple zome calls
        let aliceRequestsAndOffersIndex = -1;
        let bobRequestsAndOffersIndex = -1;
        
        // Test Alice's cells
        for (let i = 0; i < alice.cells.length; i++) {
          try {
            await alice.cells[i].callZome({
              zome_name: "service_types",
              fn_name: "get_all_service_types",
              payload: null,
            });
            aliceRequestsAndOffersIndex = i;
            console.log(`Alice: requests_and_offers DNA found at index ${i}`);
            break;
          } catch (error) {
            console.log(`Alice: Cell ${i} is not requests_and_offers DNA`);
          }
        }
        
        // Test Bob's cells
        for (let i = 0; i < bob.cells.length; i++) {
          try {
            await bob.cells[i].callZome({
              zome_name: "service_types", 
              fn_name: "get_all_service_types",
              payload: null,
            });
            bobRequestsAndOffersIndex = i;
            console.log(`Bob: requests_and_offers DNA found at index ${i}`);
            break;
          } catch (error) {
            console.log(`Bob: Cell ${i} is not requests_and_offers DNA`);
          }
        }
        
        console.log(`\n=== RESULTS ===`);
        console.log(`Alice requests_and_offers at index: ${aliceRequestsAndOffersIndex}`);
        console.log(`Bob requests_and_offers at index: ${bobRequestsAndOffersIndex}`);
        
        // Check for issues
        if (aliceRequestsAndOffersIndex !== bobRequestsAndOffersIndex) {
          console.log(`❌ ISSUE: requests_and_offers DNA is at different indices between Alice and Bob`);
          console.log(`   This explains why tests that assume cells[0] would fail!`);
        } else {
          console.log(`✅ requests_and_offers DNA is at the same index for both agents`);
        }
        
        if (aliceRequestsAndOffersIndex !== 0) {
          console.log(`❌ ISSUE: requests_and_offers DNA is not at index 0 (it's at index ${aliceRequestsAndOffersIndex})`);
          console.log(`   Tests that assume cells[0] is requests_and_offers will fail!`);
        } else {
          console.log(`✅ requests_and_offers DNA is at expected index 0`);
        }
        
        // Summary
        if (aliceRequestsAndOffersIndex === 0 && bobRequestsAndOffersIndex === 0) {
          console.log(`\n✅ NO ISSUES: DNA ordering is consistent and at expected indices`);
        } else {
          console.log(`\n❌ DNA ORDERING ISSUES DETECTED`);
          console.log(`   Root cause: Tryorama doesn't guarantee DNA ordering in multi-DNA hApps`);
          console.log(`   Solution: Use dynamic DNA identification instead of hardcoded indices`);
        }
        
        // Don't fail the test - we want to capture the diagnostic info
        // The actual assertion would be:
        // assert.equal(aliceRequestsAndOffersIndex, bobRequestsAndOffersIndex);
        // assert.equal(aliceRequestsAndOffersIndex, 0);
      }
    );
  },
  {
    timeout: 120000, // 2 minutes
  }
);