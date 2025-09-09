import { assert, expect, test } from "vitest";
import { Scenario, runScenario } from "@holochain/tryorama";
import { decode } from "@msgpack/msgpack";

type DnaProperties = {
  progenitor_pubkey: string;
};

function decodeDnaProperties(buffer: Uint8Array): DnaProperties {
  return decode(buffer) as DnaProperties;
}

// const HARDCODED_PROGENITOR_PUBKEY =
// "uhCAkVNjcdnXfoExk87X1hKArKH43bZnAidlsSgqBqeGvFpOPiUCT";
const hAppPath = process.cwd() + "/../workdir/requests_and_offers.happ";
const appSource = {
  appBundleSource: {
    type: "path" as const,
    value: hAppPath,
  },
};

test("ping", async () => {
  await runScenario(async (scenario: Scenario) => {
    const [alice] = await scenario.addPlayersWithApps([appSource]);

    // Access the requests_and_offers DNA cell by role name
    const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;

    const record: string = await aliceRequestsAndOffers.callZome({
      zome_name: "misc",
      fn_name: "ping",
    });
    expect(record).toEqual("Pong");
  });
});

// Skipped for now. Need to learn how to install a hApp with a custom property.
// test.skip("install hApp with progenitor property", async () => {
//   await runScenario(async (scenario) => {
//     const [aliceConductor, alice] = await installApp(scenario);

//     const installedProgenitorKey = decodeDnaProperties(
//       alice.cell_info["requests_and_offers"][0].provisioned.dna_modifiers
//         .properties
//     ).progenitor_pubkey;

//     // console.log(alice.cell_info["requests_and_offers"][0]);

//     assert.notEqual(installedProgenitorKey, HARDCODED_PROGENITOR_PUBKEY);
//   });
// });
