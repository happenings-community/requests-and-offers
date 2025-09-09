import { dhtSync } from "@holochain/tryorama";
import { assert, test } from "vitest";
import { decodeRecord, runScenarioWithTwoAgents } from "../utils";
import {
  User,
  createUser,
  getAgentUser,
  getLatestUser,
  getUserStatusLink,
  sampleUser,
  updateUser,
} from "../users/common";
import {
  getLatestStatusForEntity,
  getLatestStatusRecordForEntity,
  registerNetworkAdministrator,
  suspendEntityIndefinitely,
  unsuspendEntity,
  updateEntityStatus,
  getAllRevisionsForStatus,
  AdministrationEntity,
  StatusType,
} from "./common";

/**
 * FOCUSED TEST: Profile-Status Consistency - Issue #57
 * Tests edge-case scenarios where both user profiles are updated
 * along with their status transitions (accepted, suspended, re-accepted)
 * to ensure consistency in the backend.
 * Using namedCells for reliable multi-DNA cell access
 */
test("profile updates during status acceptance", async () => {
  await runScenarioWithTwoAgents(async (scenario, alice, bob) => {
    // Access the requests_and_offers DNA cells by role name
    const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
    const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

    // Create users
    let aliceSample = sampleUser({ name: "Alice" });
    await createUser(aliceRequestsAndOffers, aliceSample);
    let bobSample = sampleUser({ name: "Bob", bio: "Original bio" });
    await createUser(bobRequestsAndOffers, bobSample);

    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    const aliceUserLink = (
      await getAgentUser(aliceRequestsAndOffers, alice.agentPubKey)
    )[0];
    const bobUserLink = (
      await getAgentUser(bobRequestsAndOffers, bob.agentPubKey)
    )[0];

    // Make Alice administrator
    await registerNetworkAdministrator(
      aliceRequestsAndOffers,
      aliceUserLink.target,
      [alice.agentPubKey],
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    const bobStatusOriginalActionHash = (
      await getUserStatusLink(aliceRequestsAndOffers, bobUserLink.target)
    ).target;

    // EDGE CASE: Profile update immediately after status acceptance
    let bobLatestStatusRecord = await getLatestStatusRecordForEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );

    await updateEntityStatus(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
      bobStatusOriginalActionHash,
      bobLatestStatusRecord.signed_action.hashed.hash,
      { status_type: "accepted" },
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // Update profile immediately after acceptance
    let bobUserRecord = await getLatestUser(
      bobRequestsAndOffers,
      bobUserLink.target,
    );
    await updateUser(
      bobRequestsAndOffers,
      bobUserLink.target,
      bobUserRecord.signed_action.hashed.hash,
      sampleUser({
        name: "Bob Accepted",
        bio: "After acceptance",
        email: "bob.accepted@test.com",
      }),
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // Verify profile update succeeded and status maintained
    bobUserRecord = await getLatestUser(
      aliceRequestsAndOffers,
      bobUserLink.target,
    );
    let bobUser = decodeRecord(bobUserRecord) as User;
    assert.equal(bobUser.name, "Bob Accepted");
    assert.equal(bobUser.bio, "After acceptance");
    assert.equal(bobUser.email, "bob.accepted@test.com");

    let bobStatus = await getLatestStatusForEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );
    assert.equal(bobStatus.status_type, "accepted");
  });
});

test("profile updates during suspension", async () => {
  await runScenarioWithTwoAgents(async (scenario, alice, bob) => {
    // Access the requests_and_offers DNA cells by role name
    const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
    const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

    // Setup users and admin
    let aliceSample = sampleUser({ name: "Alice" });
    await createUser(aliceRequestsAndOffers, aliceSample);
    let bobSample = sampleUser({ name: "Bob", bio: "Original bio" });
    await createUser(bobRequestsAndOffers, bobSample);
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    const aliceUserLink = (
      await getAgentUser(aliceRequestsAndOffers, alice.agentPubKey)
    )[0];
    const bobUserLink = (
      await getAgentUser(bobRequestsAndOffers, bob.agentPubKey)
    )[0];

    await registerNetworkAdministrator(
      aliceRequestsAndOffers,
      aliceUserLink.target,
      [alice.agentPubKey],
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    const bobStatusOriginalActionHash = (
      await getUserStatusLink(aliceRequestsAndOffers, bobUserLink.target)
    ).target;

    // Accept Bob first
    let bobLatestStatusRecord = await getLatestStatusRecordForEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );

    await updateEntityStatus(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
      bobStatusOriginalActionHash,
      bobLatestStatusRecord.signed_action.hashed.hash,
      { status_type: "accepted" },
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // EDGE CASE: Profile update during suspension
    bobLatestStatusRecord = await getLatestStatusRecordForEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );

    await suspendEntityIndefinitely(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
      bobStatusOriginalActionHash,
      bobLatestStatusRecord.signed_action.hashed.hash,
      "Testing profile update during suspension",
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // Update profile while suspended
    let bobUserRecord = await getLatestUser(
      bobRequestsAndOffers,
      bobUserLink.target,
    );
    await updateUser(
      bobRequestsAndOffers,
      bobUserLink.target,
      bobUserRecord.signed_action.hashed.hash,
      sampleUser({
        name: "Bob Suspended",
        bio: "Updated during suspension",
        phone: "+1-555-TEST",
      }),
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // Verify profile updated but status unchanged
    bobUserRecord = await getLatestUser(
      aliceRequestsAndOffers,
      bobUserLink.target,
    );
    let bobUser = decodeRecord(bobUserRecord) as User;
    assert.equal(bobUser.name, "Bob Suspended");
    assert.equal(bobUser.bio, "Updated during suspension");
    assert.equal(bobUser.phone, "+1-555-TEST");

    let bobStatus = await getLatestStatusForEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );
    assert.equal(bobStatus.status_type, "suspended indefinitely");
  });
});

test("profile data persistence through re-acceptance", async () => {
  await runScenarioWithTwoAgents(async (scenario, alice, bob) => {
    // Access the requests_and_offers DNA cells by role name
    const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
    const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

    // Setup users and admin
    let aliceSample = sampleUser({ name: "Alice" });
    await createUser(aliceRequestsAndOffers, aliceSample);
    let bobSample = sampleUser({ name: "Bob", bio: "Original bio" });
    await createUser(bobRequestsAndOffers, bobSample);
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    const aliceUserLink = (
      await getAgentUser(aliceRequestsAndOffers, alice.agentPubKey)
    )[0];
    const bobUserLink = (
      await getAgentUser(bobRequestsAndOffers, bob.agentPubKey)
    )[0];

    await registerNetworkAdministrator(
      aliceRequestsAndOffers,
      aliceUserLink.target,
      [alice.agentPubKey],
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    const bobStatusOriginalActionHash = (
      await getUserStatusLink(aliceRequestsAndOffers, bobUserLink.target)
    ).target;

    // Go through full cycle: accept -> suspend with profile update -> unsuspend
    let bobLatestStatusRecord = await getLatestStatusRecordForEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );

    // Accept first
    await updateEntityStatus(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
      bobStatusOriginalActionHash,
      bobLatestStatusRecord.signed_action.hashed.hash,
      { status_type: "accepted" },
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // Suspend
    bobLatestStatusRecord = await getLatestStatusRecordForEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );

    await suspendEntityIndefinitely(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
      bobStatusOriginalActionHash,
      bobLatestStatusRecord.signed_action.hashed.hash,
      "Testing profile persistence through re-acceptance",
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // Update profile while suspended
    let bobUserRecord = await getLatestUser(
      bobRequestsAndOffers,
      bobUserLink.target,
    );
    await updateUser(
      bobRequestsAndOffers,
      bobUserLink.target,
      bobUserRecord.signed_action.hashed.hash,
      sampleUser({
        name: "Bob During Suspension",
        bio: "Data to persist",
        phone: "+1-555-PERSIST",
      }),
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // EDGE CASE: Profile data persistence through re-acceptance
    bobLatestStatusRecord = await getLatestStatusRecordForEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );

    await unsuspendEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
      bobStatusOriginalActionHash,
      bobLatestStatusRecord.signed_action.hashed.hash,
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // Verify profile data persisted through re-acceptance
    bobUserRecord = await getLatestUser(
      aliceRequestsAndOffers,
      bobUserLink.target,
    );
    let bobUser = decodeRecord(bobUserRecord) as User;
    assert.equal(bobUser.name, "Bob During Suspension"); // Profile data from suspension period persisted
    assert.equal(bobUser.bio, "Data to persist");
    assert.equal(bobUser.phone, "+1-555-PERSIST");

    let bobStatus = await getLatestStatusForEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );
    assert.equal(bobStatus.status_type, "accepted"); // But status is now accepted

    // Final profile update after re-acceptance
    bobUserRecord = await getLatestUser(
      bobRequestsAndOffers,
      bobUserLink.target,
    );
    await updateUser(
      bobRequestsAndOffers,
      bobUserLink.target,
      bobUserRecord.signed_action.hashed.hash,
      sampleUser({
        name: "Bob Final",
        bio: "Final update after re-acceptance",
        location: "New Location",
      }),
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // Final verification: profile updated, status maintained
    bobUserRecord = await getLatestUser(
      aliceRequestsAndOffers,
      bobUserLink.target,
    );
    bobUser = decodeRecord(bobUserRecord) as User;
    assert.equal(bobUser.name, "Bob Final");
    assert.equal(bobUser.bio, "Final update after re-acceptance");
    assert.equal(bobUser.location, "New Location");

    bobStatus = await getLatestStatusForEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );
    assert.equal(bobStatus.status_type, "accepted");

    // Verify status history remains intact despite profile updates
    const statusHistory = await getAllRevisionsForStatus(
      aliceRequestsAndOffers,
      bobStatusOriginalActionHash,
    );
    // Should have: pending -> accepted -> suspended -> accepted
    assert.ok(statusHistory.length >= 4);
  });
});

/**
 * FOCUSED TEST: User and Organization Profile Consistency
 * Tests that both user and organization profiles can be updated
 * during various status transitions while maintaining data consistency
 */
test("user profile consistency across multiple status changes", async () => {
  await runScenarioWithTwoAgents(async (scenario, alice, bob) => {
    // Access the requests_and_offers DNA cells by role name
    const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
    const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

    // Create users
    let aliceSample = sampleUser({ name: "Alice Admin" });
    await createUser(aliceRequestsAndOffers, aliceSample);
    let bobSample = sampleUser({
      name: "Bob User",
      bio: "Initial state",
      email: "bob.initial@test.com",
    });
    await createUser(bobRequestsAndOffers, bobSample);
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    const aliceUserLink = (
      await getAgentUser(aliceRequestsAndOffers, alice.agentPubKey)
    )[0];
    const bobUserLink = (
      await getAgentUser(bobRequestsAndOffers, bob.agentPubKey)
    )[0];

    await registerNetworkAdministrator(
      aliceRequestsAndOffers,
      aliceUserLink.target,
      [alice.agentPubKey],
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    const bobStatusOriginalActionHash = (
      await getUserStatusLink(aliceRequestsAndOffers, bobUserLink.target)
    ).target;

    // Test multiple status transitions with profile updates at each stage
    const statusTransitions = [
      {
        status: "accepted",
        profileUpdate: {
          name: "Bob Accepted",
          bio: "Accepted user profile",
          email: "bob.accepted@test.com",
          phone: "+1-555-ACCEPT",
        },
      },
      {
        status: "suspended indefinitely",
        profileUpdate: {
          name: "Bob Suspended User",
          bio: "Profile during suspension",
          location: "Suspended Location",
          website: "https://suspended.example.com",
        },
      },
    ];

    for (let i = 0; i < statusTransitions.length; i++) {
      const transition = statusTransitions[i];

      // Update status
      let bobLatestStatusRecord = await getLatestStatusRecordForEntity(
        aliceRequestsAndOffers,
        AdministrationEntity.Users,
        bobUserLink.target,
      );

      if (transition.status === "suspended indefinitely") {
        await suspendEntityIndefinitely(
          aliceRequestsAndOffers,
          AdministrationEntity.Users,
          bobUserLink.target,
          bobStatusOriginalActionHash,
          bobLatestStatusRecord.signed_action.hashed.hash,
          `Testing transition ${i + 1}`,
        );
      } else {
        await updateEntityStatus(
          aliceRequestsAndOffers,
          AdministrationEntity.Users,
          bobUserLink.target,
          bobStatusOriginalActionHash,
          bobLatestStatusRecord.signed_action.hashed.hash,
          {
            status_type: transition.status as
              | "pending"
              | "accepted"
              | "rejected"
              | "suspended temporarily"
              | "suspended indefinitely",
          },
        );
      }
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Update profile immediately after status change
      let bobUserRecord = await getLatestUser(
        bobRequestsAndOffers,
        bobUserLink.target,
      );
      await updateUser(
        bobRequestsAndOffers,
        bobUserLink.target,
        bobUserRecord.signed_action.hashed.hash,
        sampleUser(transition.profileUpdate),
      );
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify both profile and status are consistent
      bobUserRecord = await getLatestUser(
        aliceRequestsAndOffers,
        bobUserLink.target,
      );
      let bobUser = decodeRecord(bobUserRecord) as User;
      let bobStatus = await getLatestStatusForEntity(
        aliceRequestsAndOffers,
        AdministrationEntity.Users,
        bobUserLink.target,
      );

      // Verify profile data
      assert.equal(bobUser.name, transition.profileUpdate.name);
      assert.equal(bobUser.bio, transition.profileUpdate.bio);

      // Verify status
      assert.equal(bobStatus.status_type, transition.status);

      console.log(`✅ Transition ${i + 1}: Profile and status consistent`);
    }

    // Final unsuspension with profile update
    let bobLatestStatusRecord = await getLatestStatusRecordForEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );

    await unsuspendEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
      bobStatusOriginalActionHash,
      bobLatestStatusRecord.signed_action.hashed.hash,
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // Final profile update after re-acceptance
    let bobUserRecord = await getLatestUser(
      bobRequestsAndOffers,
      bobUserLink.target,
    );
    await updateUser(
      bobRequestsAndOffers,
      bobUserLink.target,
      bobUserRecord.signed_action.hashed.hash,
      sampleUser({
        name: "Bob Final State",
        bio: "Fully tested user",
        email: "bob.final@test.com",
      }),
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // Final verification
    bobUserRecord = await getLatestUser(
      aliceRequestsAndOffers,
      bobUserLink.target,
    );
    let bobUser = decodeRecord(bobUserRecord) as User;
    let bobStatus = await getLatestStatusForEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );

    assert.equal(bobUser.name, "Bob Final State");
    assert.equal(bobUser.bio, "Fully tested user");
    assert.equal(bobStatus.status_type, "accepted");

    console.log("✅ All profile-status consistency tests passed!");
  });
});
