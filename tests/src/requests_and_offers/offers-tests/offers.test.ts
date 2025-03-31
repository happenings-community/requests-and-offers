import { assert, expect, test } from "vitest";
import { Scenario, Player, dhtSync } from "@holochain/tryorama";

import { runScenarioWithTwoAgents } from "../utils";
import { createUser, getAgentUser, sampleUser } from "../users/common";
import {
  createOrganization,
  sampleOrganization,
} from "../organizations/common";
import {
  createOffer,
  deleteOffer,
  getAllOffers,
  getLatestOffer,
  getOfferCreator,
  getOfferOrganization,
  getOrganizationOffers,
  getUserOffers,
  sampleOffer,
  updateOffer,
} from "./common";
import { registerNetworkAdministrator } from "../administration/common";

// Test for basic offer operations (create, read, update, delete)
test(
  "basic offer operations",
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

        // Create an organization first
        const organization = sampleOrganization({ name: "Test Org" });
        const orgRecord = await createOrganization(
          alice.cells[0],
          organization
        );
        assert.ok(orgRecord);

        // Sync once after creating users and organization
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create an offer without organization
        const offer = sampleOffer();
        const offerRecord = await createOffer(alice.cells[0], offer);
        assert.ok(offerRecord);

        // Create an offer with organization
        const offerWithOrg = sampleOffer({ title: "Org Offer" });
        const offerWithOrgRecord = await createOffer(
          alice.cells[0],
          offerWithOrg,
          orgRecord.signed_action.hashed.hash
        );
        assert.ok(offerWithOrgRecord);

        // Sync after creating all the initial data
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Get latest offer
        const latestOffer = await getLatestOffer(
          alice.cells[0],
          offerRecord.signed_action.hashed.hash
        );
        assert.deepEqual(latestOffer, offer);

        // Update offer
        const updatedOffer = {
          ...offer,
          title: "Updated Title",
        };
        const updatedRecord = await updateOffer(
          alice.cells[0],
          offerRecord.signed_action.hashed.hash,
          offerRecord.signed_action.hashed.hash,
          updatedOffer
        );
        assert.ok(updatedRecord);

        // Sync after update
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify that the offer was updated
        const updatedOfferData = await getLatestOffer(
          alice.cells[0],
          offerRecord.signed_action.hashed.hash
        );
        assert.ok(updatedOfferData);
        assert.equal(updatedOfferData.title, "Updated Title");

        // Get Alice's user hash for user-related operations
        const aliceUserHash = (
          await getAgentUser(alice.cells[0], alice.agentPubKey)
        )[0].target;

        // Get all offers
        const allOffers = await getAllOffers(alice.cells[0]);
        assert.lengthOf(allOffers, 2);

        // Get user offers
        const userOffers = await getUserOffers(alice.cells[0], aliceUserHash);
        assert.lengthOf(userOffers, 2);

        // Get organization offers
        const orgOffers = await getOrganizationOffers(
          alice.cells[0],
          orgRecord.signed_action.hashed.hash
        );
        assert.lengthOf(orgOffers, 1);

        // Verify that Bob cannot update Alice's offer
        expect(
          updateOffer(
            bob.cells[0],
            offerRecord.signed_action.hashed.hash,
            offerRecord.signed_action.hashed.hash,
            { ...offer, title: "Bob's update" }
          )
        ).rejects.toThrow();

        // Verify that Bob cannot delete Alice's offer
        expect(
          deleteOffer(bob.cells[0], offerRecord.signed_action.hashed.hash)
        ).rejects.toThrow();

        // Delete an offer
        const deleteResult = await deleteOffer(
          alice.cells[0],
          offerWithOrgRecord.signed_action.hashed.hash
        );
        assert.ok(deleteResult);

        // Final sync after delete
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify the offer was deleted
        const allOffersAfterDelete = await getAllOffers(alice.cells[0]);
        assert.lengthOf(allOffersAfterDelete, 1);

        // Verify the offer was removed from organization offers
        const orgOffersAfterDelete = await getOrganizationOffers(
          alice.cells[0],
          orgRecord.signed_action.hashed.hash
        );
        assert.lengthOf(orgOffersAfterDelete, 0);

        // Verify the offer was removed from user offers
        const userOffersAfterDelete = await getUserOffers(
          alice.cells[0],
          aliceUserHash
        );
        assert.lengthOf(userOffersAfterDelete, 1);
      }
    );
  },
  {
    timeout: 300000, // 5 minutes should be enough
  }
);

// Test for administrator operations on offers
test(
  "administrator offer operations",
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

        // Create an offer for Bob
        const bobOffer = sampleOffer({ title: "Bob's Offer" });
        const bobOfferRecord = await createOffer(bob.cells[0], bobOffer);
        assert.ok(bobOfferRecord);

        // Create another offer for Bob that we'll update later
        const bobOffer2 = sampleOffer({ title: "Bob's Second Offer" });
        const bobOffer2Record = await createOffer(bob.cells[0], bobOffer2);
        assert.ok(bobOffer2Record);

        // Sync after initial setup
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify that Alice cannot update Bob's offer initially
        try {
          await updateOffer(
            alice.cells[0],
            bobOffer2Record.signed_action.hashed.hash,
            bobOffer2Record.signed_action.hashed.hash,
            { ...bobOffer2, title: "Updated by Alice" }
          );
          assert.fail("Alice should not be able to update Bob's offer");
        } catch (error) {
          // Expected error
        }

        // Verify that Alice cannot delete Bob's offer initially
        try {
          await deleteOffer(
            alice.cells[0],
            bobOfferRecord.signed_action.hashed.hash
          );
          assert.fail("Alice should not be able to delete Bob's offer");
        } catch (error) {
          // Expected error
        }

        // Get Alice's user hash for making her an administrator
        const aliceUserHash = (
          await getAgentUser(alice.cells[0], alice.agentPubKey)
        )[0].target;

        // Make Alice an administrator
        const addAdminResult = await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserHash,
          [alice.agentPubKey]
        );
        assert.ok(addAdminResult);

        // Sync after making Alice an administrator
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify that Alice (as an administrator) can now update Bob's offer
        const updatedOffer = {
          ...bobOffer2,
          title: "Updated by Admin Alice",
        };

        const adminUpdateRecord = await updateOffer(
          alice.cells[0],
          bobOffer2Record.signed_action.hashed.hash,
          bobOffer2Record.signed_action.hashed.hash,
          updatedOffer
        );
        assert.ok(adminUpdateRecord);

        // Sync after admin update
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify the offer was updated by the administrator
        const updatedOfferData = await getLatestOffer(
          bob.cells[0],
          bobOffer2Record.signed_action.hashed.hash
        );
        assert.ok(updatedOfferData, "Failed to retrieve the updated offer");
        assert.equal(
          updatedOfferData.title,
          "Updated by Admin Alice",
          "Admin update to title was not applied"
        );

        // Also verify that Bob can see the updated offer
        const bobViewOfUpdatedOffer = await getLatestOffer(
          bob.cells[0],
          bobOffer2Record.signed_action.hashed.hash
        );
        assert.equal(
          bobViewOfUpdatedOffer.title,
          "Updated by Admin Alice",
          "Bob cannot see the admin update to title"
        );

        // Verify that Alice (as an administrator) can now delete Bob's offer
        await deleteOffer(
          alice.cells[0],
          bobOfferRecord.signed_action.hashed.hash
        );

        // Sync after admin delete
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Verify the offer was deleted by the administrator
        const allOffersAfterAdminDelete = await getAllOffers(bob.cells[0]);
        assert.lengthOf(allOffersAfterAdminDelete, 1); // Only the updated offer remains
      }
    );
  },
  {
    timeout: 300000, // 5 minutes should be enough
  }
);

// Test for offer creator and organization retrieval
test(
  "offer creator and organization retrieval",
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

        // Create an organization first
        const organization = sampleOrganization({ name: "Test Org" });
        const orgRecord = await createOrganization(
          alice.cells[0],
          organization
        );
        assert.ok(orgRecord);

        // Sync after creating users and organization
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create an offer without organization
        const offer = sampleOffer();
        const offerRecord = await createOffer(alice.cells[0], offer);
        assert.ok(offerRecord);

        // Create an offer with organization
        const offerWithOrg = sampleOffer({ title: "Org Offer" });
        const offerWithOrgRecord = await createOffer(
          alice.cells[0],
          offerWithOrg,
          orgRecord.signed_action.hashed.hash
        );
        assert.ok(offerWithOrgRecord);

        // Sync after creating all the initial data
        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Get Alice's user hash for comparison
        const aliceUserLink = await getAgentUser(
          alice.cells[0],
          alice.agentPubKey
        );
        const aliceUserHash = aliceUserLink[0].target;

        // Test getOfferCreator for offer without organization
        const creator = await getOfferCreator(
          alice.cells[0],
          offerRecord.signed_action.hashed.hash
        );
        assert.ok(creator);
        assert.deepEqual(creator, aliceUserHash);

        // Test getOfferCreator for offer with organization
        const creatorWithOrg = await getOfferCreator(
          alice.cells[0],
          offerWithOrgRecord.signed_action.hashed.hash
        );
        assert.ok(creatorWithOrg);
        assert.deepEqual(creatorWithOrg, aliceUserHash);

        // Test getOfferOrganization for offer without organization
        const orgLink = await getOfferOrganization(
          alice.cells[0],
          offerRecord.signed_action.hashed.hash
        );
        assert.isNull(orgLink); // Should be null as no organization was linked

        // Test getOfferOrganization for offer with organization
        const orgLinkWithOrg = await getOfferOrganization(
          alice.cells[0],
          offerWithOrgRecord.signed_action.hashed.hash
        );
        assert.ok(orgLinkWithOrg);
        assert.deepEqual(orgLinkWithOrg, orgRecord.signed_action.hashed.hash);

        // Test getting creator of non-existent offer
        const fakeActionHash = new Uint8Array(32).fill(1); // Create a fake action hash
        try {
          await getOfferCreator(alice.cells[0], fakeActionHash);
          assert.fail(
            "Should not be able to get creator of non-existent offer"
          );
        } catch (error) {
          // Expected error
        }

        // Test getting organization of non-existent offer
        try {
          await getOfferOrganization(alice.cells[0], fakeActionHash);
          assert.fail(
            "Should not be able to get organization of non-existent offer"
          );
        } catch (error) {
          // Expected error
        }
      }
    );
  },
  {
    timeout: 300000, // 5 minutes should be enough
  }
);
