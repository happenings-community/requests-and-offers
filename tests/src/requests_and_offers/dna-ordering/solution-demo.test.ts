import { assert, test } from "vitest";
import { Scenario, Player, dhtSync } from "@holochain/tryorama";
import { runScenarioWithTwoAgents } from "../utils";
import { 
  runScenarioWithReliableCells, 
  getRequestsAndOffersCell,
  getRequestsAndOffersIndex 
} from "./dna-utils";
import { createUser, sampleUser } from "../users/common";
import { registerNetworkAdministrator } from "../administration/common";
import { 
  createServiceType, 
  getAllServiceTypes, 
  sampleServiceType,
  ServiceTypeInput 
} from "../service-types-tests/common";

/**
 * This test demonstrates the solution to the DNA ordering issue.
 * Instead of assuming alice.cells[0] is the requests_and_offers DNA,
 * we use utility functions to reliably identify the correct cell.
 */

test(
  "Solution demo - reliable DNA access using utility functions",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        console.log("=== DEMONSTRATING THE SOLUTION ===");
        
        // OLD WAY (problematic): Assume index 0 is requests_and_offers
        console.log("\n❌ OLD WAY - Assuming requests_and_offers is at index 0:");
        console.log(`   alice.cells[0] - might be wrong DNA`);
        console.log(`   bob.cells[0] - might be wrong DNA`);
        
        // NEW WAY (reliable): Find the correct cells dynamically
        console.log("\n✅ NEW WAY - Dynamically finding correct DNA cells:");
        
        const aliceRequestsAndOffers = await getRequestsAndOffersCell(alice);
        const bobRequestsAndOffers = await getRequestsAndOffersCell(bob);
        const aliceIndex = await getRequestsAndOffersIndex(alice);
        const bobIndex = await getRequestsAndOffersIndex(bob);
        
        console.log(`   Alice requests_and_offers DNA found at index: ${aliceIndex}`);
        console.log(`   Bob requests_and_offers DNA found at index: ${bobIndex}`);
        
        assert.isNotNull(aliceRequestsAndOffers, "Alice requests_and_offers cell should be found");
        assert.isNotNull(bobRequestsAndOffers, "Bob requests_and_offers cell should be found");
        
        // Demonstrate that we can now reliably call zome functions
        console.log("\n✅ Testing zome function calls with reliable cell access:");
        
        // Create users (needed for admin registration)
        const aliceUser = sampleUser({ name: "Alice" });
        const aliceUserRecord = await createUser(aliceRequestsAndOffers!, aliceUser);
        assert.ok(aliceUserRecord);
        
        const bobUser = sampleUser({ name: "Bob" });  
        const bobUserRecord = await createUser(bobRequestsAndOffers!, bobUser);
        assert.ok(bobUserRecord);
        
        // Register Alice as admin
        await registerNetworkAdministrator(
          aliceRequestsAndOffers!,
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );
        
        // Sync after setup
        await dhtSync([alice, bob], aliceRequestsAndOffers!.cell_id[0]);
        
        // Test creating service types with reliable cell access
        const serviceType = sampleServiceType({
          name: "Test Service",
          description: "Testing reliable DNA access",
        });
        
        const serviceTypeInput: ServiceTypeInput = {
          service_type: serviceType,
        };
        
        const serviceTypeRecord = await createServiceType(
          aliceRequestsAndOffers!,
          serviceTypeInput
        );
        assert.ok(serviceTypeRecord);
        console.log("   ✅ Successfully created service type using reliable cell access");
        
        // Sync and verify
        await dhtSync([alice, bob], aliceRequestsAndOffers!.cell_id[0]);
        
        const allServiceTypes = await getAllServiceTypes(aliceRequestsAndOffers!);
        assert.lengthOf(allServiceTypes, 1);
        console.log("   ✅ Successfully retrieved service types using reliable cell access");
        
        // Verify both agents can access the data
        const bobServiceTypes = await getAllServiceTypes(bobRequestsAndOffers!);
        assert.lengthOf(bobServiceTypes, 1);
        console.log("   ✅ Both agents can access data using reliable cell references");
        
        console.log("\n🎉 SOLUTION WORKS: Reliable DNA access eliminates ordering issues!");
      }
    );
  },
  {
    timeout: 180000,
  }
);

test(
  "Solution demo - using the wrapper function for even cleaner code",
  async () => {
    await runScenarioWithReliableCells(
      async (alice, bob, aliceRequestsAndOffers, bobRequestsAndOffers, aliceHREA, bobHREA) => {
        console.log("=== DEMONSTRATING THE WRAPPER FUNCTION SOLUTION ===");
        console.log("✅ All DNA cells are automatically identified and passed as parameters");
        console.log(`   aliceRequestsAndOffers: Available`);
        console.log(`   bobRequestsAndOffers: Available`);  
        console.log(`   aliceHREA: ${aliceHREA ? 'Available' : 'Not available'}`);
        console.log(`   bobHREA: ${bobHREA ? 'Available' : 'Not available'}`);
        
        // Create users
        const aliceUser = sampleUser({ name: "Alice" });
        const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
        
        const bobUser = sampleUser({ name: "Bob" });
        const bobUserRecord = await createUser(bobRequestsAndOffers, bobUser);
        
        // Register admin
        await registerNetworkAdministrator(
          aliceRequestsAndOffers,
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );
        
        // Sync
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);
        
        // Test functionality  
        const serviceType = await createServiceType(aliceRequestsAndOffers, {
          service_type: sampleServiceType({
            name: "Wrapper Demo Service",
            description: "Testing the wrapper function approach"
          })
        });
        
        await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);
        
        const aliceServiceTypes = await getAllServiceTypes(aliceRequestsAndOffers);
        const bobServiceTypes = await getAllServiceTypes(bobRequestsAndOffers);
        
        assert.lengthOf(aliceServiceTypes, 1);
        assert.lengthOf(bobServiceTypes, 1);
        
        console.log("🎉 WRAPPER SOLUTION WORKS: Clean, reliable, and easy to use!");
      }
    );
  },
  {
    timeout: 180000,
  }
);