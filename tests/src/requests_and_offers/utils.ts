import fs from "fs";
import { Conductor, Player, Scenario, runScenario } from "@holochain/tryorama";
import {
  AppRoleManifest,
  AppWebsocket,
  Record,
  WsClient,
} from "@holochain/client";
import { decode } from "@msgpack/msgpack";
import { Base64 } from "js-base64";
import { decompressSync } from "fflate";

const hAppPath = process.cwd() + "/../workdir/requests_and_offers.happ";
const appSource = { appBundleSource: { path: hAppPath } };

export type DnaProperties = {
  progenitor_pubkey: string;
};

export async function runScenarioWithTwoAgents(
  callback: (scenario: Scenario, alice: Player, bob: Player) => Promise<void>
): Promise<void> {
  await runScenario(async (scenario) => {
    const [alice, bob] = await scenario.addPlayersWithApps([
      appSource,
      appSource,
    ]);

    await scenario.shareAllAgents();

    console.log("Running scenario with Alice and Bob");

    await callback(scenario, alice, bob);

    scenario.cleanUp();
  });
}

/**
 * Decodes a set of records using MessagePack.
 * @param records The records to decode.
 * @returns {unknown[]} The decoded records.
 */
export function decodeRecords(records: Record[]): unknown[] {
  return records.map((r) => decode((r.entry as any).Present.entry));
}

/**
 * Represents the type of a WebAssembly error.
 */
enum WasmErrorType {
  PointerMap = "PointerMap",
  Deserialize = "Deserialize",
  Serialize = "Serialize",
  ErrorWhileError = "ErrorWhileError",
  Memory = "Memory",
  Guest = "Guest",
  Host = "Host",
  HostShortCircuit = "HostShortCircuit",
  Compile = "Compile",
  CallError = "CallError",
  UninitializedSerializedModuleCache = "UninitializedSerializedModuleCache",
  Unknown = "Unknown",
}

/**
 * Represents a WebAssembly error.
 */
type WasmError = {
  type: WasmErrorType;
  message: string;
};

/**
 * Extracts a WebAssembly error message encapsulated within a "Guest(...)" string pattern.
 * @param message - The error message.
 * @returns {WasmError} The WebAssembly error.
 */
export function extractWasmErrorMessage(message: string): WasmError {
  const messageRegex = /Guest\("(.+)"\)/;
  const matchedMessage = message.match(messageRegex);
  console.log("message : ", matchedMessage);

  const wasmErrorTypeRegex = /type: (.+),/; // Todo: fix the regex
  const matchedWasmErrorType = message.match(wasmErrorTypeRegex);
  console.log("wasmErrorType : ", matchedWasmErrorType);

  const wasmError: WasmError = {
    type: matchedWasmErrorType
      ? (matchedWasmErrorType[1] as WasmErrorType)
      : WasmErrorType.Unknown,
    message: matchedMessage ? matchedMessage[1] : "Unknown error",
  };

  return wasmError;
}

/**
 * Converts a base64 encoded hash to a Uint8Array.
 * @param hash - The base64 encoded hash
 * @returns {Uint8Array} The decoded hash
 */
export function deserializeHash(hash: string): Uint8Array {
  return Base64.toUint8Array(hash.slice(1));
}

export function serializeHash(hash: Uint8Array) {
  return `u${Base64.fromUint8Array(hash, true)}`;
}

export async function installApp(
  scenario: Scenario
): Promise<[Scenario, AppWebsocket]> {
  const conductor = await scenario.addConductor();
  const adminWs = conductor.adminWs();
  const agentPubKey = await adminWs.generateAgentPubKey();

  const appBundleBytes = fs.readFileSync(hAppPath);
  const appBundle = decode(
    decompressSync(new Uint8Array(appBundleBytes))
  ) as any;

  // Configure requests_and_offers DNA
  const requestsAndOffersRole = appBundle.manifest.roles.find(
    (r: AppRoleManifest) => r.name === "requests_and_offers"
  )!;
  requestsAndOffersRole.dna.modifiers = {
    network_seed: "throwaway",
    properties: {
      progenitor_pubkey: serializeHash(agentPubKey),
    },
  };

  // Configure HREA DNA
  const hreaRole = appBundle.manifest.roles.find(
    (r: AppRoleManifest) => r.name === "hrea"
  )!;
  if (hreaRole) {
    hreaRole.dna.modifiers = {
      network_seed: "throwaway",
      properties: {},
    };
  }

  await conductor.installApp(
    { bundle: appBundle },
    {
      installedAppId: "requests_and_offers",
      agentPubKey: agentPubKey,
    }
  );
  await conductor
    .adminWs()
    .enableApp({ installed_app_id: "requests_and_offers" });

  const appWebSocket = await conductor.connectAppWs([], 0);
  console.log("appWebSocket", appWebSocket);

  return [scenario, appWebSocket];
}

export function imagePathToArrayBuffer(
  imagePath: string
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    fs.readFile(imagePath, (err, buffer) => {
      if (err) {
        reject(err);
        return;
      }

      // Convert Buffer to ArrayBuffer
      const arrayBuffer = Uint8Array.from(buffer).buffer;

      resolve(arrayBuffer);
    });
  });
}
