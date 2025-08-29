import { Player, CallableCell } from "@holochain/tryorama";

/**
 * Utility functions to reliably identify and access the correct DNA cells
 * regardless of their ordering in the Tryorama player.cells array.
 */

/**
 * Identifies which cell belongs to the requests_and_offers DNA by attempting
 * to call a known zome function.
 * 
 * @param player The Tryorama player
 * @returns The CallableCell for the requests_and_offers DNA, or null if not found
 */
export async function getRequestsAndOffersCell(player: Player): Promise<CallableCell | null> {
  for (const cell of player.cells) {
    try {
      // Try to call a function that only exists in the requests_and_offers DNA
      await cell.callZome({
        zome_name: "service_types",
        fn_name: "get_all_service_types", 
        payload: null,
      });
      // If we get here without an error, this is the requests_and_offers DNA
      return cell;
    } catch (error) {
      // This cell doesn't have the service_types zome, continue looking
      continue;
    }
  }
  
  return null;
}

/**
 * Identifies which cell belongs to the hREA DNA by attempting to call a known
 * hREA zome function.
 * 
 * @param player The Tryorama player
 * @returns The CallableCell for the hREA DNA, or null if not found
 */
export async function getHREACell(player: Player): Promise<CallableCell | null> {
  for (const cell of player.cells) {
    try {
      // Try to call a function that should exist in the hREA DNA
      // Note: This might need adjustment based on actual hREA zome structure
      await cell.callZome({
        zome_name: "agent",
        fn_name: "get_my_agent",
        payload: null,
      });
      // If we get here without an error, this is the hREA DNA
      return cell;
    } catch (error) {
      // This cell doesn't have the expected hREA zome, continue looking
      continue;
    }
  }
  
  return null;
}

/**
 * Gets the index of the requests_and_offers DNA in the player.cells array.
 * 
 * @param player The Tryorama player
 * @returns The index of the requests_and_offers DNA, or -1 if not found
 */
export async function getRequestsAndOffersIndex(player: Player): Promise<number> {
  for (let i = 0; i < player.cells.length; i++) {
    try {
      await player.cells[i].callZome({
        zome_name: "service_types",
        fn_name: "get_all_service_types",
        payload: null,
      });
      return i;
    } catch (error) {
      continue;
    }
  }
  
  return -1;
}

/**
 * Gets the index of the hREA DNA in the player.cells array.
 * 
 * @param player The Tryorama player  
 * @returns The index of the hREA DNA, or -1 if not found
 */
export async function getHREAIndex(player: Player): Promise<number> {
  for (let i = 0; i < player.cells.length; i++) {
    try {
      await player.cells[i].callZome({
        zome_name: "agent",
        fn_name: "get_my_agent", 
        payload: null,
      });
      return i;
    } catch (error) {
      continue;
    }
  }
  
  return -1;
}

/**
 * Diagnostic function to analyze the DNA structure of a player's cells.
 * Useful for debugging and understanding the current state.
 * 
 * @param player The Tryorama player
 * @param playerName Optional name for logging (e.g., "Alice", "Bob")
 */
export async function analyzeDNAStructure(player: Player, playerName: string = "Player"): Promise<void> {
  console.log(`\n=== DNA Analysis for ${playerName} ===`);
  console.log(`Total cells: ${player.cells.length}`);
  
  for (let i = 0; i < player.cells.length; i++) {
    const cell = player.cells[i];
    const cellId = cell.cell_id[0].toString();
    
    // Try to identify the DNA type
    let dnaType = "unknown";
    const availableZomes: string[] = [];
    
    // Check for requests_and_offers DNA
    try {
      await cell.callZome({
        zome_name: "service_types",
        fn_name: "get_all_service_types",
        payload: null,
      });
      dnaType = "requests_and_offers";
      availableZomes.push("service_types", "requests", "offers", "users", "organizations", "administration", "mediums_of_exchange", "exchanges");
    } catch (error) {
      // Not requests_and_offers DNA
    }
    
    // Check for hREA DNA (if not already identified)
    if (dnaType === "unknown") {
      try {
        await cell.callZome({
          zome_name: "agent",
          fn_name: "get_my_agent",
          payload: null,
        });
        dnaType = "hrea";
        availableZomes.push("agent", "specification", "observation", "planning", "commitment", "satisfaction", "proposal");
      } catch (error) {
        // Not hREA DNA either
      }
    }
    
    console.log(`  Cell[${i}]: ${dnaType}`);
    console.log(`    Cell ID: ${cellId.substring(0, 16)}...`);
    if (availableZomes.length > 0) {
      console.log(`    Zomes: ${availableZomes.join(', ')}`);
    }
  }
}

/**
 * Wrapper function for runScenarioWithTwoAgents that ensures we have reliable
 * access to the correct DNA cells.
 * 
 * @param callback The test callback that will receive reliable cell references
 */
export async function runScenarioWithReliableCells(
  callback: (
    alice: Player, 
    bob: Player, 
    aliceRequestsAndOffers: CallableCell,
    bobRequestsAndOffers: CallableCell,
    aliceHREA: CallableCell | null,
    bobHREA: CallableCell | null
  ) => Promise<void>
): Promise<void> {
  const { runScenarioWithTwoAgents } = await import("../utils");
  
  await runScenarioWithTwoAgents(
    async (scenario, alice: Player, bob: Player) => {
      // Analyze DNA structure for debugging
      await analyzeDNAStructure(alice, "Alice");
      await analyzeDNAStructure(bob, "Bob");
      
      // Get reliable cell references
      const aliceRequestsAndOffers = await getRequestsAndOffersCell(alice);
      const bobRequestsAndOffers = await getRequestsAndOffersCell(bob);
      const aliceHREA = await getHREACell(alice);
      const bobHREA = await getHREACell(bob);
      
      if (!aliceRequestsAndOffers || !bobRequestsAndOffers) {
        throw new Error("Could not find requests_and_offers DNA cells for both players");
      }
      
      console.log(`\n✅ Successfully identified DNA cells:`);
      console.log(`   Alice requests_and_offers: Found`);
      console.log(`   Bob requests_and_offers: Found`);
      console.log(`   Alice hREA: ${aliceHREA ? 'Found' : 'Not found'}`);
      console.log(`   Bob hREA: ${bobHREA ? 'Found' : 'Not found'}`);
      
      await callback(alice, bob, aliceRequestsAndOffers, bobRequestsAndOffers, aliceHREA, bobHREA);
    }
  );
}