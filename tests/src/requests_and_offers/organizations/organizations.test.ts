import { assert, expect, test } from "vitest";
import TestUserPicture from "./assets/favicon.png";

import { Scenario, Player, dhtSync, PlayerApp } from "@holochain/tryorama";
import { Link, Record } from "@holochain/client";

import { imagePathToArrayBuffer, runScenarioWithTwoAgents } from "../utils.js";
import {
  createUser,
  getAcceptedUsersLinks,
  getAgentUser,
  getUserStatusLink,
  sampleUser,
  User,
} from "../users/common";
import {
  AdministrationEntity,
  getLatestStatusRecordForEntity,
  registerNetworkAdministrator,
  updateEntityStatus,
} from "../administration/common";
import {
  addCoordinatorToOrganization,
  addMemberToOrganization,
  checkIfAgentIsOrganizationCoordinator,
  createOrganization,
  deleteOrganization,
  getAllOrganizationsLinks,
  getAcceptedOrganizationsLinks,
  getLatestOrganization,
  getOrganizationCoordinatorsLinks,
  getOrganizationMembersLinks,
  getOrganizationStatusLink,
  getUserOrganizationsLinks,
  leaveOrganization,
  removeOrganizationCoordinator,
  removeOrganizationMember,
  sampleOrganization,
  updateOrganization,
} from "./common";

// Test for basic organization operations (create, read, update)
test("basic organization operations", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Create users for Alice and Bob
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(
        aliceRequestsAndOffers,
        aliceUser,
      );
      assert.ok(aliceUserRecord);

      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bobRequestsAndOffers, bobUser);
      assert.ok(bobUserRecord);

      // Sync after creating users
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Bob tries to create an Organization without having a user profile accepted
      const buffer = await imagePathToArrayBuffer(
        process.cwd() + TestUserPicture,
      );
      let sampleOrg = sampleOrganization({
        name: "Organization",
        logo: new Uint8Array(buffer),
      });

      // Bob creates an Organization
      const orgRecord = await createOrganization(
        bobRequestsAndOffers,
        sampleOrg,
      );
      const bobOrganizationOriginalActionHash =
        orgRecord.signed_action.hashed.hash;
      assert.ok(orgRecord);

      // Sync after creating organization
      await dhtSync([alice, bob], bobRequestsAndOffers.cell_id[0]);

      // Bob reads the Organization record
      let organization = await getLatestOrganization(
        bobRequestsAndOffers,
        bobOrganizationOriginalActionHash,
      );
      assert.equal(organization.name, sampleOrg.name);

      // Verify that Bob is a member of the Organization
      const organizationMembers = await getOrganizationMembersLinks(
        bobRequestsAndOffers,
        bobOrganizationOriginalActionHash,
      );
      assert.lengthOf(organizationMembers, 1);

      const bobUserLink = (
        await getAgentUser(aliceRequestsAndOffers, bob.agentPubKey)
      )[0];
      assert.deepEqual(organizationMembers[0].target, bobUserLink.target);

      // Verify that Bob is a coordinator of the Organization
      let organizationLinks = await getOrganizationCoordinatorsLinks(
        aliceRequestsAndOffers,
        bobOrganizationOriginalActionHash,
      );
      assert.lengthOf(organizationLinks, 1);
      assert.ok(
        await checkIfAgentIsOrganizationCoordinator(
          bobRequestsAndOffers,
          bobOrganizationOriginalActionHash,
        ),
      );
      assert.deepEqual(organizationLinks[0].target, bobUserLink.target);

      // Bob updates his Organization
      sampleOrg = sampleOrganization({
        name: "Bob's Organization",
        logo: new Uint8Array(buffer),
      });
      await updateOrganization(
        bobRequestsAndOffers,
        bobOrganizationOriginalActionHash,
        bobOrganizationOriginalActionHash,
        sampleOrg,
      );
      assert.ok(orgRecord);

      // Sync after updating organization
      await dhtSync([alice, bob], bobRequestsAndOffers.cell_id[0]);

      // Verify the Organization has been updated
      organization = await getLatestOrganization(
        bobRequestsAndOffers,
        bobOrganizationOriginalActionHash,
      );
      assert.equal(organization.name, sampleOrg.name);

      // Verify that Bob still a coordinator of the Organization
      organizationLinks = await getOrganizationCoordinatorsLinks(
        bobRequestsAndOffers,
        bobOrganizationOriginalActionHash,
      );
      assert.lengthOf(organizationLinks, 1);
      assert.ok(
        await checkIfAgentIsOrganizationCoordinator(
          bobRequestsAndOffers,
          bobOrganizationOriginalActionHash,
        ),
      );
    },
  );
});

// Test for organization membership operations
test("organization membership operations", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Create users for Alice and Bob
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(
        aliceRequestsAndOffers,
        aliceUser,
      );
      assert.ok(aliceUserRecord);

      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bobRequestsAndOffers, bobUser);
      assert.ok(bobUserRecord);

      // Sync after creating users to ensure links are propagated
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Get user links with error checking and retry if needed
      const bobUserLinks = await getAgentUser(
        aliceRequestsAndOffers,
        bob.agentPubKey,
      );
      assert.ok(
        bobUserLinks && bobUserLinks.length > 0,
        "Failed to get Bob's user link after multiple attempts",
      );
      const bobUserLink = bobUserLinks[0];

      // Make Alice a network administrator with similar retry logic
      const aliceUserLinks = await getAgentUser(
        aliceRequestsAndOffers,
        alice.agentPubKey,
      );
      assert.ok(
        aliceUserLinks && aliceUserLinks.length > 0,
        "Failed to get Alice's user link after multiple attempts",
      );
      const aliceUserLink = aliceUserLinks[0];

      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserLink.target,
        [alice.agentPubKey],
      );

      // Sync after making Alice an admin
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Accept Bob's user profile
      const bobStatusOriginalActionHash = (
        await getUserStatusLink(aliceRequestsAndOffers, bobUserLink.target)
      ).target;

      const bobLatestStatusActionHash = (
        await getLatestStatusRecordForEntity(
          aliceRequestsAndOffers,
          AdministrationEntity.Users,
          bobUserLink.target,
        )
      ).signed_action.hashed.hash;

      await updateEntityStatus(
        aliceRequestsAndOffers,
        AdministrationEntity.Users,
        bobUserLink.target,
        bobLatestStatusActionHash,
        bobStatusOriginalActionHash,
        {
          status_type: "accepted",
        },
      );

      // Accept Alice's user profile
      const aliceStatusOriginalActionHash = (
        await getUserStatusLink(aliceRequestsAndOffers, aliceUserLink.target)
      ).target;

      const aliceLatestStatusActionHash = (
        await getLatestStatusRecordForEntity(
          aliceRequestsAndOffers,
          AdministrationEntity.Users,
          aliceUserLink.target,
        )
      ).signed_action.hashed.hash;

      await updateEntityStatus(
        aliceRequestsAndOffers,
        AdministrationEntity.Users,
        aliceUserLink.target,
        aliceLatestStatusActionHash,
        aliceStatusOriginalActionHash,
        {
          status_type: "accepted",
        },
      );

      // Sync after setting up users
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Bob creates an Organization
      const buffer = await imagePathToArrayBuffer(
        process.cwd() + TestUserPicture,
      );
      const bobOrg = sampleOrganization({
        name: "Bob's Organization",
        logo: new Uint8Array(buffer),
      });

      const bobOrgRecord = await createOrganization(
        bobRequestsAndOffers,
        bobOrg,
      );
      const bobOrganizationOriginalActionHash =
        bobOrgRecord.signed_action.hashed.hash;
      assert.ok(bobOrgRecord);

      // Alice creates her own Organization
      const aliceOrg = sampleOrganization({ name: "Alice's Organization" });
      const aliceOrgRecord = await createOrganization(
        aliceRequestsAndOffers,
        aliceOrg,
      );
      const aliceOrganizationOriginalActionHash =
        aliceOrgRecord.signed_action.hashed.hash;
      assert.ok(aliceOrgRecord);

      // Sync after creating organizations
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Add additional sync and verification before accepting organizations
      const aliceOrgStatus = await getOrganizationStatusLink(
        aliceRequestsAndOffers,
        aliceOrganizationOriginalActionHash,
      );
      assert.ok(
        aliceOrgStatus,
        "Failed to get Alice's organization status link",
      );

      const bobOrgStatus = await getOrganizationStatusLink(
        bobRequestsAndOffers,
        bobOrganizationOriginalActionHash,
      );
      assert.ok(bobOrgStatus, "Failed to get Bob's organization status link");

      // Get the status record hashes needed for updating
      const aliceOrganizationStatusOriginalActionHash = aliceOrgStatus.target;

      const aliceOrganizationLatestStatusActionHash = (
        await getLatestStatusRecordForEntity(
          aliceRequestsAndOffers,
          AdministrationEntity.Organizations,
          aliceOrganizationOriginalActionHash,
        )
      ).signed_action.hashed.hash;

      const bobOrganizationLatestStatusActionHash = (
        await getLatestStatusRecordForEntity(
          bobRequestsAndOffers,
          AdministrationEntity.Organizations,
          bobOrganizationOriginalActionHash,
        )
      ).signed_action.hashed.hash;

      // Now the updateEntityStatus calls will work
      await updateEntityStatus(
        aliceRequestsAndOffers,
        AdministrationEntity.Organizations,
        aliceOrganizationOriginalActionHash,
        aliceOrganizationLatestStatusActionHash,
        aliceOrgStatus.target, // Use this instead of aliceOrganizationStatusOriginalActionHash
        {
          status_type: "accepted",
        },
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      await updateEntityStatus(
        aliceRequestsAndOffers,
        AdministrationEntity.Organizations,
        bobOrganizationOriginalActionHash,
        bobOrganizationLatestStatusActionHash,
        bobOrgStatus.target, // Use this instead of bobOrganizationStatusOriginalActionHash
        {
          status_type: "accepted",
        },
      );

      // Additional sync after accepting organizations
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify that the organizations are accepted
      const acceptedOrganizations = await getAcceptedOrganizationsLinks(
        aliceRequestsAndOffers,
      );
      assert.lengthOf(acceptedOrganizations, 2);

      // Alice adds Bob as a member of her Organization
      assert.ok(
        await addMemberToOrganization(
          aliceRequestsAndOffers,
          aliceOrganizationOriginalActionHash,
          bobUserLink.target,
        ),
      );

      // Sync after adding Bob as a member
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify that Bob is a member of Alice's Organization
      const organizationMembers = await getOrganizationMembersLinks(
        aliceRequestsAndOffers,
        aliceOrganizationOriginalActionHash,
      );
      assert.lengthOf(organizationMembers, 2);
      assert.deepEqual(organizationMembers[1].target, bobUserLink.target);

      // Alice adds Bob as a coordinator of her Organization
      assert.ok(
        await addCoordinatorToOrganization(
          aliceRequestsAndOffers,
          aliceOrganizationOriginalActionHash,
          bobUserLink.target,
        ),
      );

      // Sync after adding Bob as a coordinator
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify that Bob is a coordinator of Alice's Organization
      const organizationLinks = await getOrganizationCoordinatorsLinks(
        aliceRequestsAndOffers,
        aliceOrganizationOriginalActionHash,
      );
      assert.lengthOf(organizationLinks, 2);
      assert.ok(
        await checkIfAgentIsOrganizationCoordinator(
          bobRequestsAndOffers,
          aliceOrganizationOriginalActionHash,
        ),
      );
    },
  );
});

// Test for organization coordinator and member removal
test("organization coordinator and member removal", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Create users for Alice and Bob
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(
        aliceRequestsAndOffers,
        aliceUser,
      );
      assert.ok(aliceUserRecord);

      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bobRequestsAndOffers, bobUser);
      assert.ok(bobUserRecord);

      // Sync after creating users to ensure links are propagated
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Get user links with error checking
      const bobUserLinks = await getAgentUser(
        aliceRequestsAndOffers,
        bob.agentPubKey,
      );
      assert.ok(
        bobUserLinks && bobUserLinks.length > 0,
        "Failed to get Bob's user link",
      );
      const bobUserLink = bobUserLinks[0];

      // Make Alice a network administrator
      const aliceUserLinks = await getAgentUser(
        aliceRequestsAndOffers,
        alice.agentPubKey,
      );
      assert.ok(
        aliceUserLinks && aliceUserLinks.length > 0,
        "Failed to get Alice's user link",
      );
      const aliceUserLink = aliceUserLinks[0];

      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserLink.target,
        [alice.agentPubKey],
      );

      // Sync after making Alice an admin
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Accept Bob's user profile
      const bobStatusOriginalActionHash = (
        await getUserStatusLink(aliceRequestsAndOffers, bobUserLink.target)
      ).target;

      const bobLatestStatusActionHash = (
        await getLatestStatusRecordForEntity(
          aliceRequestsAndOffers,
          AdministrationEntity.Users,
          bobUserLink.target,
        )
      ).signed_action.hashed.hash;

      await updateEntityStatus(
        aliceRequestsAndOffers,
        AdministrationEntity.Users,
        bobUserLink.target,
        bobLatestStatusActionHash,
        bobStatusOriginalActionHash,
        {
          status_type: "accepted",
        },
      );

      // Accept Alice's user profile
      const aliceStatusOriginalActionHash = (
        await getUserStatusLink(aliceRequestsAndOffers, aliceUserLink.target)
      ).target;
      const aliceLatestStatusActionHash = (
        await getLatestStatusRecordForEntity(
          aliceRequestsAndOffers,
          AdministrationEntity.Users,
          aliceUserLink.target,
        )
      ).signed_action.hashed.hash;
      await updateEntityStatus(
        aliceRequestsAndOffers,
        AdministrationEntity.Users,
        aliceUserLink.target,
        aliceLatestStatusActionHash,
        aliceStatusOriginalActionHash,
        {
          status_type: "accepted",
        },
      );

      // Create and accept Alice's organization
      const aliceOrg = sampleOrganization({ name: "Alice's Organization" });
      const aliceOrgRecord = await createOrganization(
        aliceRequestsAndOffers,
        aliceOrg,
      );
      const aliceOrganizationOriginalActionHash =
        aliceOrgRecord.signed_action.hashed.hash;

      const aliceOrganizationStatusOriginalActionHash = (
        await getOrganizationStatusLink(
          aliceRequestsAndOffers,
          aliceOrganizationOriginalActionHash,
        )
      ).target;
      const aliceOrganizationLatestStatusActionHash = (
        await getLatestStatusRecordForEntity(
          aliceRequestsAndOffers,
          AdministrationEntity.Organizations,
          aliceOrganizationOriginalActionHash,
        )
      ).signed_action.hashed.hash;
      await updateEntityStatus(
        aliceRequestsAndOffers,
        AdministrationEntity.Organizations,
        aliceOrganizationOriginalActionHash,
        aliceOrganizationLatestStatusActionHash,
        aliceOrganizationStatusOriginalActionHash,
        {
          status_type: "accepted",
        },
      );

      // Sync after setup
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Add Bob as a member and coordinator of Alice's organization
      await addMemberToOrganization(
        aliceRequestsAndOffers,
        aliceOrganizationOriginalActionHash,
        bobUserLink.target,
      );
      await addCoordinatorToOrganization(
        aliceRequestsAndOffers,
        aliceOrganizationOriginalActionHash,
        bobUserLink.target,
      );

      // Sync after adding Bob
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Bob removes Alice as a coordinator of the Organization
      assert.ok(
        await removeOrganizationCoordinator(
          bobRequestsAndOffers,
          aliceOrganizationOriginalActionHash,
          aliceUserLink.target,
        ),
      );

      // Sync after removing Alice as coordinator
      await dhtSync([alice, bob], bobRequestsAndOffers.cell_id[0]);

      // Verify that Alice is not a coordinator of the Organization
      assert.notOk(
        await checkIfAgentIsOrganizationCoordinator(
          aliceRequestsAndOffers,
          aliceOrganizationOriginalActionHash,
        ),
      );

      const organizationLinks = await getOrganizationCoordinatorsLinks(
        bobRequestsAndOffers,
        aliceOrganizationOriginalActionHash,
      );
      assert.lengthOf(organizationLinks, 1);
      assert.deepEqual(organizationLinks[0].target, bobUserLink.target);

      // Bob removes Alice as a member of the Organization
      assert.ok(
        await removeOrganizationMember(
          bobRequestsAndOffers,
          aliceOrganizationOriginalActionHash,
          aliceUserLink.target,
        ),
      );

      // Sync after removing Alice as member
      await dhtSync([alice, bob], bobRequestsAndOffers.cell_id[0]);

      // Verify that Alice is no longer a member of the Organization
      const organizationMembers = await getOrganizationMembersLinks(
        bobRequestsAndOffers,
        aliceOrganizationOriginalActionHash,
      );
      assert.lengthOf(organizationMembers, 1);
      assert.deepEqual(organizationMembers[0].target, bobUserLink.target);

      // Bob can not leave Alice's Organization because he is the last coordinator
      await expect(
        leaveOrganization(
          bobRequestsAndOffers,
          aliceOrganizationOriginalActionHash,
        ),
      ).rejects.toThrow();

      // Sync after failed leave attempt
      await dhtSync([alice, bob], bobRequestsAndOffers.cell_id[0]);

      // Bob adds Alice as a coordinator of the Organization
      assert.ok(
        await addCoordinatorToOrganization(
          bobRequestsAndOffers,
          aliceOrganizationOriginalActionHash,
          aliceUserLink.target,
        ),
      );

      // Sync after adding Alice back as coordinator
      await dhtSync([alice, bob], bobRequestsAndOffers.cell_id[0]);

      // Bob can now leave Alice's Organization
      assert.ok(
        await leaveOrganization(
          bobRequestsAndOffers,
          aliceOrganizationOriginalActionHash,
        ),
      );

      // Sync after Bob leaves
      await dhtSync([alice, bob], bobRequestsAndOffers.cell_id[0]);

      // Verify that Bob is no longer a member of Alice's Organization
      const organizationMembersAfterLeave = await getOrganizationMembersLinks(
        aliceRequestsAndOffers,
        aliceOrganizationOriginalActionHash,
      );
      assert.lengthOf(organizationMembersAfterLeave, 1);
    },
  );
});

// Test for organization deletion
test("organization deletion", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Create users for Alice and Bob
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(
        aliceRequestsAndOffers,
        aliceUser,
      );
      assert.ok(aliceUserRecord);

      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bobRequestsAndOffers, bobUser);
      assert.ok(bobUserRecord);

      // Sync after creating users to ensure links are propagated
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Get user links
      const bobUserLinks = await getAgentUser(
        aliceRequestsAndOffers,
        bob.agentPubKey,
      );
      assert.ok(
        bobUserLinks && bobUserLinks.length > 0,
        "Failed to get Bob's user link",
      );
      const bobUserLink = bobUserLinks[0];

      // Make Alice a network administrator
      const aliceUserLinks = await getAgentUser(
        aliceRequestsAndOffers,
        alice.agentPubKey,
      );
      assert.ok(
        aliceUserLinks && aliceUserLinks.length > 0,
        "Failed to get Alice's user link",
      );
      const aliceUserLink = aliceUserLinks[0];

      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserLink.target,
        [alice.agentPubKey],
      );

      // Sync after making Alice an admin
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Accept Bob's user profile
      const bobStatusOriginalActionHash = (
        await getUserStatusLink(aliceRequestsAndOffers, bobUserLink.target)
      ).target;

      const bobLatestStatusActionHash = (
        await getLatestStatusRecordForEntity(
          aliceRequestsAndOffers,
          AdministrationEntity.Users,
          bobUserLink.target,
        )
      ).signed_action.hashed.hash;

      await updateEntityStatus(
        aliceRequestsAndOffers,
        AdministrationEntity.Users,
        bobUserLink.target,
        bobLatestStatusActionHash,
        bobStatusOriginalActionHash,
        {
          status_type: "accepted",
        },
      );

      // Accept Alice's user profile
      const aliceStatusOriginalActionHash = (
        await getUserStatusLink(aliceRequestsAndOffers, aliceUserLink.target)
      ).target;
      const aliceLatestStatusActionHash = (
        await getLatestStatusRecordForEntity(
          aliceRequestsAndOffers,
          AdministrationEntity.Users,
          aliceUserLink.target,
        )
      ).signed_action.hashed.hash;
      await updateEntityStatus(
        aliceRequestsAndOffers,
        AdministrationEntity.Users,
        aliceUserLink.target,
        aliceLatestStatusActionHash,
        aliceStatusOriginalActionHash,
        {
          status_type: "accepted",
        },
      );

      // Create organizations for Alice and Bob
      const aliceOrg = sampleOrganization({ name: "Alice's Organization" });
      const aliceOrgRecord = await createOrganization(
        aliceRequestsAndOffers,
        aliceOrg,
      );
      const aliceOrganizationOriginalActionHash =
        aliceOrgRecord.signed_action.hashed.hash;

      const bobOrg = sampleOrganization({ name: "Bob's Organization" });
      const bobOrgRecord = await createOrganization(
        bobRequestsAndOffers,
        bobOrg,
      );
      const bobOrganizationOriginalActionHash =
        bobOrgRecord.signed_action.hashed.hash;

      // After creating organizations
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Get organization status links
      const aliceOrgStatus = await getOrganizationStatusLink(
        aliceRequestsAndOffers,
        aliceOrganizationOriginalActionHash,
      );
      assert.ok(
        aliceOrgStatus,
        "Failed to get Alice's organization status link",
      );

      const bobOrgStatus = await getOrganizationStatusLink(
        bobRequestsAndOffers,
        bobOrganizationOriginalActionHash,
      );
      assert.ok(bobOrgStatus, "Failed to get Bob's organization status link");

      // Get the status record hashes needed for updating
      const aliceOrganizationStatusOriginalActionHash = aliceOrgStatus.target;

      const aliceOrganizationLatestStatusActionHash = (
        await getLatestStatusRecordForEntity(
          aliceRequestsAndOffers,
          AdministrationEntity.Organizations,
          aliceOrganizationOriginalActionHash,
        )
      ).signed_action.hashed.hash;

      const bobOrganizationLatestStatusActionHash = (
        await getLatestStatusRecordForEntity(
          bobRequestsAndOffers,
          AdministrationEntity.Organizations,
          bobOrganizationOriginalActionHash,
        )
      ).signed_action.hashed.hash;

      // Accept both organizations with additional sync
      await updateEntityStatus(
        aliceRequestsAndOffers,
        AdministrationEntity.Organizations,
        aliceOrganizationOriginalActionHash,
        aliceOrganizationLatestStatusActionHash,
        aliceOrganizationStatusOriginalActionHash,
        {
          status_type: "accepted",
        },
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      await updateEntityStatus(
        aliceRequestsAndOffers,
        AdministrationEntity.Organizations,
        bobOrganizationOriginalActionHash,
        bobOrganizationLatestStatusActionHash,
        bobOrgStatus.target,
        {
          status_type: "accepted",
        },
      );

      // Additional sync after accepting organizations
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Delete Alice's Organization by suspending it indefinitely
      await updateEntityStatus(
        aliceRequestsAndOffers,
        AdministrationEntity.Organizations,
        aliceOrganizationOriginalActionHash,
        aliceOrganizationLatestStatusActionHash,
        aliceOrganizationStatusOriginalActionHash,
        {
          status_type: "suspended indefinitely",
        },
      );

      // Sync after suspension
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify that Alice's Organization is effectively deleted
      assert.lengthOf(
        await getAcceptedOrganizationsLinks(aliceRequestsAndOffers),
        1,
      );
      assert.lengthOf(
        await getUserOrganizationsLinks(
          aliceRequestsAndOffers,
          aliceUserLink.target,
        ),
        1,
      );

      // Bob deletes his Organization
      assert.ok(
        await deleteOrganization(
          bobRequestsAndOffers,
          bobOrganizationOriginalActionHash,
        ),
      );

      // Sync after Bob deletes his organization
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify that Bob's Organization is deleted
      assert.lengthOf(
        await getAcceptedOrganizationsLinks(bobRequestsAndOffers),
        0,
      );
      assert.lengthOf(
        await getUserOrganizationsLinks(
          bobRequestsAndOffers,
          bobUserLink.target,
        ),
        0,
      );
    },
  );
});

// Test for organization administration capabilities
test("organization administration capabilities", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Create users for Alice and Bob
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(
        aliceRequestsAndOffers,
        aliceUser,
      );
      assert.ok(aliceUserRecord);

      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bobRequestsAndOffers, bobUser);
      assert.ok(bobUserRecord);

      // Sync after creating users to ensure links are propagated
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Get user links with error checking
      const bobUserLinks = await getAgentUser(
        aliceRequestsAndOffers,
        bob.agentPubKey,
      );
      assert.ok(
        bobUserLinks && bobUserLinks.length > 0,
        "Failed to get Bob's user link",
      );

      // Make Alice a network administrator
      const aliceUserLinks = await getAgentUser(
        aliceRequestsAndOffers,
        alice.agentPubKey,
      );
      assert.ok(
        aliceUserLinks && aliceUserLinks.length > 0,
        "Failed to get Alice's user link",
      );
      const aliceUserLink = aliceUserLinks[0];

      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserLink.target,
        [alice.agentPubKey],
      );

      // Sync after making Alice an admin
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Alice can get all the Organizations because she is a network administrator
      const allOrganizationsLinks = await getAllOrganizationsLinks(
        aliceRequestsAndOffers,
      );
      assert.lengthOf(allOrganizationsLinks, 0); // No organizations yet

      // Verify that Bob can not get all the Organizations because he is not a network administrator
      await expect(
        getAllOrganizationsLinks(bobRequestsAndOffers),
      ).rejects.toThrow();

      // Verify that there is no accepted Organization
      const acceptedOrganizationsLinks = await getAcceptedOrganizationsLinks(
        aliceRequestsAndOffers,
      );
      assert.lengthOf(acceptedOrganizationsLinks, 0);

      // Verify that the accepted Organizations is not counted as accepted users
      const acceptedUsers = await getAcceptedUsersLinks(aliceRequestsAndOffers);
      assert.lengthOf(acceptedUsers, 0); // No accepted users yet
    },
  );
});
