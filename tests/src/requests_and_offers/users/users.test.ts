import { assert, expect, test } from "vitest";
import TestUserPicture from "./assets/favicon.png";

import { Scenario, Player, dhtSync } from "@holochain/tryorama";
import { Record } from "@holochain/client";

import {
  User,
  sampleUser,
  createUser,
  getAgentUser,
  getLatestUser,
  updateUser,
} from "./common.js";
import {
  decodeRecord,
  decodeRecords,
  imagePathToArrayBuffer,
  runScenarioWithTwoAgents,
} from "../utils.js";
import {
  AdministrationEntity,
  getLatestStatusForEntity,
} from "../administration/common";

test(
  "create and read User",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        let sample: User;
        let record: Record;

        // Alice creates a User
        sample = sampleUser({ name: "Alice" });
        record = await createUser(alice.cells[0], sample);
        const aliceCreatedUser = decodeRecord(record) as User;
        assert.ok(record);
        assert.equal(aliceCreatedUser.name, sample.name);

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Alice get her user
        const aliceUserLink = await getAgentUser(
          alice.cells[0],
          alice.agentPubKey,
        );
        assert.ok(aliceUserLink);

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Bob gets the created User
        const createdRecord: Record = await getLatestUser(
          bob.cells[0],
          record.signed_action.hashed.hash,
        );
        const bobCreatedUser = decodeRecords([createdRecord])[0] as User;

        assert.containsAllKeys(aliceCreatedUser, bobCreatedUser);

        // Verify that the user status is "pending"
        const bobStatus = await getLatestStatusForEntity(
          bob.cells[0],
          AdministrationEntity.Users,
          record.signed_action.hashed.hash,
        );

        assert.equal(bobStatus.status_type, "pending");

        // Bob try to get his user before he create it
        const links = await getAgentUser(bob.cells[0], bob.agentPubKey);
        assert.equal(links.length, 0);

        // Bob create an User with erroneous UserType
        let errSample: User = sampleUser({
          user_type: "Non Authorized",
        });

        await expect(createUser(bob.cells[0], errSample)).rejects.toThrow();

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Bob create an User with erroneous user Picture
        errSample = sampleUser({
          name: "Bob",
          picture: new Uint8Array(20),
        });
        await expect(createUser(bob.cells[0], errSample)).rejects.toThrow();

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Bob creates a User with a real image file
        const buffer = await imagePathToArrayBuffer(
          process.cwd() + TestUserPicture,
        );

        sample = sampleUser({
          name: "Bob",
          picture: new Uint8Array(buffer),
        });
        record = await createUser(bob.cells[0], sample);
        assert.ok(record);

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Alice get the created User
        record = await getLatestUser(
          alice.cells[0],
          record.signed_action.hashed.hash,
        );
        assert.ok(record);
      },
    );
  },
  { timeout: 180000 },
);

test(
  "create and update User",
  async () => {
    await runScenarioWithTwoAgents(async (_scenario, alice, bob) => {
      let sample: User;

      sample = sampleUser({ name: "Alice" });
      const record = await createUser(alice.cells[0], sample);
      const originalUserHash = record.signed_action.hashed.hash;

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      const buffer = await imagePathToArrayBuffer(
        process.cwd() + TestUserPicture,
      );

      // Alice update her user with a valid user picture
      sample = sampleUser({
        name: "Alicia",
        nickname: "Alicialia",
        picture: new Uint8Array(buffer),
      });

      await updateUser(
        alice.cells[0],
        originalUserHash,
        record.signed_action.hashed.hash,
        sample,
      );

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      let latestUserRecord = await getLatestUser(
        alice.cells[0],
        originalUserHash,
      );
      let aliceUser = decodeRecords([latestUserRecord])[0] as User;
      assert.equal(sample.name, aliceUser.name);

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Alice update her user with an invalid user picture
      sample = sampleUser({
        name: "Alicia",
        nickname: "Alicialia",
        picture: new Uint8Array(20),
      });
      await expect(
        updateUser(
          alice.cells[0],
          originalUserHash,
          latestUserRecord.signed_action.hashed.hash,
          sample,
        ),
      ).rejects.toThrow();

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob try to update Alice's user
      sample = sampleUser({
        name: "Bob",
      });
      await expect(
        updateUser(
          bob.cells[0],
          originalUserHash,
          latestUserRecord.signed_action.hashed.hash,
          sample,
        ),
      ).rejects.toThrow();

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Alice update here user again
      sample = sampleUser({
        name: "Alice",
        nickname: "Alicia",
      });

      await updateUser(
        alice.cells[0],
        originalUserHash,
        latestUserRecord.signed_action.hashed.hash,
        sample,
      );

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      latestUserRecord = await getLatestUser(alice.cells[0], originalUserHash);
      aliceUser = decodeRecords([latestUserRecord])[0] as User;
      assert.equal(aliceUser.nickname, sample.nickname);
    });
  },
  { timeout: 180000 },
);

// test("get progenitor pubkey", async () => {
//   await runScenarioWithTwoAgents(async (scenario, alice, bob) => {
//     let guestDnaProperties = decode(
//       alice.cells[0].dna_modifiers.properties
//     ) as DnaProperties;
//     let hostDnaProperties = await getDnaProperties(alice.cells[0]);

//     assert.equal(
//       guestDnaProperties.progenitor_pubkey,
//       hostDnaProperties.progenitor_pubkey
//     );
//   });
// });
