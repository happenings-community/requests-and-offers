import { assert, test, expect } from "vitest";
import { Scenario, Player, PlayerApp } from "@holochain/tryorama";
import { runScenarioWithTwoAgents } from "../utils";
import { ProvisionedCell } from "@holochain/client/lib";

/**
 * This test demonstrates the DNA ordering inconsistency issue.
 *
 * ISSUE: When multiple DNAs are defined in the hApp manifest, Tryorama loads them
 * but the order is not guaranteed. Our hApp has two DNAs:
 * 1. requests_and_offers (custom DNA)
 * 2. hrea (hREA DNA)
 *
 * The problem is that tests assume alice.cells[0] is always the requests_and_offers DNA,
 * but sometimes it might be the hrea DNA at index 0, causing tests to fail.
 */

interface DNAInfo {
  name: string;
  index: number;
  cell_id: string;
  zomes: string[];
}

async function identifyDNAs(player: PlayerApp): Promise<DNAInfo[]> {
  const dnaInfos: DNAInfo[] = [];

  for (let i = 0; i < player.cells.length; i++) {
    const cell = player.cells[i];
    const cellId = cell.cell_id[0]; // DNA hash

    // Try to identify the DNA by calling known zome functions
    let dnaName = "unknown";
    const availableZomes: string[] = [];

    try {
      // Try to call a function specific to requests_and_offers DNA
      await cell.callZome({
        zome_name: "service_types",
        fn_name: "get_all_service_types",
        payload: null,
      });
      dnaName = "requests_and_offers";
      availableZomes.push(
        "service_types",
        "requests",
        "offers",
        "users",
        "organizations",
        "administration",
        "mediums_of_exchange",
        "exchanges",
      );
    } catch (error) {
      // Service types zome doesn't exist, might be hrea DNA
    }

    try {
      // Try to call a function specific to hREA DNA
      // Using a common hREA function - this might fail if hREA doesn't have this exact function
      await cell.callZome({
        zome_name: "agent",
        fn_name: "get_my_agent",
        payload: null,
      });
      if (dnaName === "unknown") {
        dnaName = "hrea";
        availableZomes.push(
          "agent",
          "specification",
          "observation",
          "planning",
          "commitment",
          "satisfaction",
          "proposal",
        );
      }
    } catch (error) {
      // Agent zome doesn't exist or function doesn't exist
    }

    // If still unknown, try to identify by any zome calls that work
    if (dnaName === "unknown") {
      // Get app info to see what zomes are available
      try {
        const appInfo = await player.appWs.appInfo();
        if (appInfo) {
          for (const [roleName, cellInfo] of Object.entries(
            appInfo.cell_info,
          )) {
            if (Array.isArray(cellInfo) && cellInfo.length > 0) {
              const cellData = cellInfo[0];
              if ("provisioned" in cellData) {
                const provisioned = cellData.provisioned as ProvisionedCell;
                if (provisioned.cell_id[0].toString() === cellId.toString()) {
                  dnaName = roleName;
                  break;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to get app info:", error);
      }
    }

    dnaInfos.push({
      name: dnaName,
      index: i,
      cell_id: cellId.toString(),
      zomes: availableZomes,
    });
  }

  return dnaInfos;
}

test("DNA ordering consistency test - identify which DNA is at which index", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      console.log("=== DNA ORDERING ANALYSIS ===");

      // Analyze Alice's cells
      console.log(`\nAlice has ${alice.cells.length} cells:`);
      const aliceDNAs = await identifyDNAs(alice);
      aliceDNAs.forEach((dna, index) => {
        console.log(
          `  Cell[${index}]: ${dna.name} (zomes: ${dna.zomes.join(", ")})`,
        );
      });

      // Analyze Bob's cells
      console.log(`\nBob has ${bob.cells.length} cells:`);
      const bobDNAs = await identifyDNAs(bob);
      bobDNAs.forEach((dna, index) => {
        console.log(
          `  Cell[${index}]: ${dna.name} (zomes: ${dna.zomes.join(", ")})`,
        );
      });

      // Check if ordering is consistent between agents
      console.log("\n=== CONSISTENCY CHECK ===");
      let orderingConsistent = true;

      if (alice.cells.length !== bob.cells.length) {
        console.log(
          `❌ ISSUE: Alice has ${alice.cells.length} cells, Bob has ${bob.cells.length} cells`,
        );
        orderingConsistent = false;
      }

      for (let i = 0; i < Math.min(alice.cells.length, bob.cells.length); i++) {
        const aliceDNA = aliceDNAs[i];
        const bobDNA = bobDNAs[i];

        if (aliceDNA.name !== bobDNA.name) {
          console.log(
            `❌ ISSUE: At index ${i}, Alice has '${aliceDNA.name}' but Bob has '${bobDNA.name}'`,
          );
          orderingConsistent = false;
        } else {
          console.log(
            `✅ Index ${i}: Both Alice and Bob have '${aliceDNA.name}'`,
          );
        }
      }

      if (orderingConsistent) {
        console.log("\n✅ DNA ordering is consistent between agents");
      } else {
        console.log("\n❌ DNA ordering is INCONSISTENT between agents");
      }

      // Find the requests_and_offers DNA index for both agents
      const aliceRequestsAndOffersIndex = aliceDNAs.findIndex(
        (dna) => dna.name === "requests_and_offers",
      );
      const bobRequestsAndOffersIndex = bobDNAs.findIndex(
        (dna) => dna.name === "requests_and_offers",
      );

      console.log(`\nrequests_and_offers DNA location:`);
      console.log(`  Alice: index ${aliceRequestsAndOffersIndex}`);
      console.log(`  Bob: index ${bobRequestsAndOffersIndex}`);

      if (aliceRequestsAndOffersIndex !== bobRequestsAndOffersIndex) {
        console.log(
          `❌ CRITICAL ISSUE: requests_and_offers DNA is at different indices!`,
        );
        console.log(
          `   This explains why tests fail - they assume it's always at index 0`,
        );
      }

      if (
        aliceRequestsAndOffersIndex !== 0 ||
        bobRequestsAndOffersIndex !== 0
      ) {
        console.log(
          `❌ ISSUE: requests_and_offers DNA is not at index 0 as expected by tests`,
        );
      }

      // Expected to fail sometimes due to the issue
      expect(aliceRequestsAndOffersIndex).toBe(bobRequestsAndOffersIndex);
      expect(aliceRequestsAndOffersIndex).toBe(0);

      // Test that we can actually call zome functions on the correct cells
      if (aliceRequestsAndOffersIndex >= 0 && bobRequestsAndOffersIndex >= 0) {
        console.log("\nTesting zome function calls on correct DNA...");

        try {
          const aliceServiceTypes = await alice.cells[
            aliceRequestsAndOffersIndex
          ].callZome({
            zome_name: "service_types",
            fn_name: "get_all_service_types",
            payload: null,
          });
          console.log("✅ Alice can call service_types functions");

          const bobServiceTypes = await bob.cells[
            bobRequestsAndOffersIndex
          ].callZome({
            zome_name: "service_types",
            fn_name: "get_all_service_types",
            payload: null,
          });
          console.log("✅ Bob can call service_types functions");
        } catch (error) {
          console.log(`❌ Error calling zome functions: ${error}`);
        }
      }
    },
  );
});

test(
  "Multiple runs to demonstrate inconsistent DNA ordering",
  async () => {
    const results: Array<{
      run: number;
      aliceIndex: number;
      bobIndex: number;
    }> = [];

    // Run the same test multiple times to capture inconsistency
    for (let run = 1; run <= 5; run++) {
      try {
        await runScenarioWithTwoAgents(
          async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
            const aliceDNAs = await identifyDNAs(alice);
            const bobDNAs = await identifyDNAs(bob);

            const aliceIndex = aliceDNAs.findIndex(
              (dna) => dna.name === "requests_and_offers",
            );
            const bobIndex = bobDNAs.findIndex(
              (dna) => dna.name === "requests_and_offers",
            );

            results.push({ run, aliceIndex, bobIndex });

            console.log(
              `Run ${run}: Alice requests_and_offers at index ${aliceIndex}, Bob at index ${bobIndex}`,
            );
          },
        );
      } catch (error) {
        console.log(`Run ${run} failed: ${error}`);
        results.push({ run, aliceIndex: -1, bobIndex: -1 });
      }
    }

    // Analyze results
    console.log("\n=== MULTIPLE RUNS ANALYSIS ===");
    console.log("Run results:");
    results.forEach((result) => {
      const consistent = result.aliceIndex === result.bobIndex;
      const atExpectedIndex = result.aliceIndex === 0 && result.bobIndex === 0;
      console.log(
        `  Run ${result.run}: Alice[${result.aliceIndex}], Bob[${result.bobIndex}] - ${consistent ? "✅ Consistent" : "❌ Inconsistent"} - ${atExpectedIndex ? "✅ At expected index 0" : "❌ Not at expected index"}`,
      );
    });

    // Check for inconsistencies
    const hasInconsistentOrdering = results.some(
      (r) => r.aliceIndex !== r.bobIndex,
    );
    const hasNonZeroIndices = results.some(
      (r) => r.aliceIndex !== 0 || r.bobIndex !== 0,
    );
    const hasVariableIndices =
      new Set(results.map((r) => `${r.aliceIndex}-${r.bobIndex}`)).size > 1;

    console.log(`\nIssues detected:`);
    console.log(
      `  Inconsistent ordering between agents: ${hasInconsistentOrdering ? "❌ YES" : "✅ NO"}`,
    );
    console.log(
      `  DNA not at expected index 0: ${hasNonZeroIndices ? "❌ YES" : "✅ NO"}`,
    );
    console.log(
      `  Variable indices across runs: ${hasVariableIndices ? "❌ YES" : "✅ NO"}`,
    );

    if (hasInconsistentOrdering || hasNonZeroIndices || hasVariableIndices) {
      console.log(`\n❌ DNA ORDERING ISSUES CONFIRMED`);
      console.log(`   This demonstrates why tests fail intermittently!`);
    } else {
      console.log(`\n✅ No DNA ordering issues detected in this test run`);
      console.log(
        `   Note: The issue might be intermittent - run this test multiple times`,
      );
    }
  },
  {
    timeout: 300000, // 5 minutes for multiple runs
  },
);
