import { dhtSync } from "@holochain/tryorama";
import { assert, expect, test } from "vitest";
import { decodeRecord, runScenarioWithTwoAgents } from "../utils";
import {
  User,
  createUser,
  getAcceptedUsersLinks,
  getAgentUser,
  getLatestUser,
  getUserStatusLink,
  sampleUser,
  updateUser,
} from "../users/common";
import {
  checkIfEntityIsAdministrator,
  getAllUsers,
  getLatestStatusForEntity,
  getLatestStatusRecordForEntity,
  registerNetworkAdministrator,
  suspendEntityIndefinitely,
  suspendEntityTemporarily,
  unsuspendEntity,
  unsuspendEntityIfTimePassed,
  updateEntityStatus,
  getAllRevisionsForStatus,
  AdministrationEntity,
} from "./common";

/**
 * FOCUSED TEST: Status Management
 * Tests user status updates, suspensions, and unsuspensions
 * Using namedCells for reliable multi-DNA cell access
 */
test("user status management and suspension workflow", async () => {
  await runScenarioWithTwoAgents(async (scenario, alice, bob) => {
    // Access the requests_and_offers DNA cells by role name
    const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
    const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

    let sample: User;
    sample = sampleUser({ name: "Alice" });
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

    // Register Alice as administrator
    await registerNetworkAdministrator(
      aliceRequestsAndOffers,
      aliceUserLink.target,
      [alice.agentPubKey],
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // Verify that Alice is an administrator
    assert.ok(
      await checkIfEntityIsAdministrator(
        aliceRequestsAndOffers,
        aliceUserLink.target,
      ),
    );

    // Alice updates her user profile
    sample = sampleUser({
      name: "Alice",
      nickname: "Alicia",
    });
    await updateUser(
      aliceRequestsAndOffers,
      aliceUserLink.target,
      aliceUserLink.target,
      sample,
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // Verify that Alice still in All Users
    let allUsers = await getAllUsers(aliceRequestsAndOffers);
    assert.equal(allUsers.length, 2);

    // Verify Alice's profile update persisted
    let aliceLatestUserRecord = await getLatestUser(
      aliceRequestsAndOffers,
      aliceUserLink.target,
    );
    let aliceLatestUser = decodeRecord(aliceLatestUserRecord) as User;
    assert.ok(aliceLatestUser);
    assert.equal(aliceLatestUser.name, "Alice");
    assert.equal(aliceLatestUser.nickname, "Alicia");

    // Update Alice's status
    const aliceStatusOriginalActionHash = (
      await getUserStatusLink(aliceRequestsAndOffers, aliceUserLink.target)
    ).target;
    const aliceLatestStatusRecord = await getLatestStatusRecordForEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      aliceUserLink.target,
    );

    await updateEntityStatus(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      aliceUserLink.target,
      aliceStatusOriginalActionHash,
      aliceLatestStatusRecord.signed_action.hashed.hash,
      {
        status_type: "accepted",
      },
    );

    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // Verify that Alice's status is "accepted"
    let aliceStatus = await getLatestStatusForEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      aliceUserLink.target,
    );

    assert.equal(aliceStatus.status_type, "accepted");

    // Verify the all_users list
    allUsers = await getAllUsers(aliceRequestsAndOffers);
    assert.equal(allUsers.length, 2);

    // Verify the accepted_users list
    const AcceptedEntities = await getAcceptedUsersLinks(
      aliceRequestsAndOffers,
    );

    assert.equal(AcceptedEntities.length, 1);

    // Bob can not update his status
    const bobStatusOriginalActionHash = (
      await getUserStatusLink(bobRequestsAndOffers, bobUserLink.target)
    ).target;
    let bobLatestStatusRecord = await getLatestStatusRecordForEntity(
      bobRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );

    await expect(
      updateEntityStatus(
        bobRequestsAndOffers,
        AdministrationEntity.Users,
        bobUserLink.target,
        bobStatusOriginalActionHash,
        bobLatestStatusRecord.signed_action.hashed.hash,
        {
          status_type: "accepted",
        },
      ),
    ).rejects.toThrow();

    // Alice suspends Bob indefinitely
    await suspendEntityIndefinitely(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
      bobStatusOriginalActionHash,
      bobLatestStatusRecord.signed_action.hashed.hash,
      "Bob is a naughty boy",
    );

    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // Alice verify that her status is still "accepted"
    aliceStatus = await getLatestStatusForEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      aliceUserLink.target,
    );
    assert.equal(aliceStatus.status_type, "accepted");

    // Verify that Bob's status is "suspended"
    let bobStatus = await getLatestStatusForEntity(
      bobRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );
    assert.equal(bobStatus.status_type, "suspended indefinitely");

    bobLatestStatusRecord = await getLatestStatusRecordForEntity(
      bobRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );

    // Alice unsuspends Bob
    await unsuspendEntity(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
      bobStatusOriginalActionHash,
      bobLatestStatusRecord.signed_action.hashed.hash,
    );

    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // Verify that Bob's status is "accepted"
    bobStatus = await getLatestStatusForEntity(
      bobRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );
    assert.equal(bobStatus.status_type, "accepted");
  });
});

/**
 * FOCUSED TEST: Temporary Suspension
 * Tests temporary suspension with time-based unsuspension
 */
test("temporary suspension and time-based unsuspension", async () => {
  await runScenarioWithTwoAgents(async (scenario, alice, bob) => {
    // Access the requests_and_offers DNA cells by role name
    const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
    const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

    // Create users and make Alice admin
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

    await registerNetworkAdministrator(
      aliceRequestsAndOffers,
      aliceUserLink.target,
      [alice.agentPubKey],
    );
    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    const bobStatusOriginalActionHash = (
      await getUserStatusLink(bobRequestsAndOffers, bobUserLink.target)
    ).target;
    let bobLatestStatusRecord = await getLatestStatusRecordForEntity(
      bobRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );

    // Alice suspends Bob for 7 days
    await suspendEntityTemporarily(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
      bobStatusOriginalActionHash,
      bobLatestStatusRecord.signed_action.hashed.hash,
      "Bob is a naughty boy",
      7,
    );

    await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

    // Verify that Bob's status is suspended for 7 days
    let bobStatus = await getLatestStatusForEntity(
      bobRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );

    const suspensionTime = new Date(bobStatus.suspended_until);
    const now = new Date();
    const diffInDays = Math.round(
      (suspensionTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    assert.equal(diffInDays, 7);

    // Alice tries to unsuspend Bob with the unsuspendEntityIfTimePassed function
    bobLatestStatusRecord = await getLatestStatusRecordForEntity(
      bobRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
    );

    const isUnsuspended = await unsuspendEntityIfTimePassed(
      aliceRequestsAndOffers,
      AdministrationEntity.Users,
      bobUserLink.target,
      bobStatusOriginalActionHash,
      bobLatestStatusRecord.signed_action.hashed.hash,
    );

    assert.equal(isUnsuspended, false);

    // Alice manually unsuspends Bob
    bobLatestStatusRecord = await getLatestStatusRecordForEntity(
      bobRequestsAndOffers,
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

    // Alice gets the suspension history of Bob
    const suspensionHistory = await getAllRevisionsForStatus(
      aliceRequestsAndOffers,
      bobStatusOriginalActionHash,
    );

    assert.ok(suspensionHistory.length >= 3); // pending -> suspended -> accepted
  });
});