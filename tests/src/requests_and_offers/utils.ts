import fs from "fs";
import {
  Conductor,
  Player,
  PlayerApp,
  Scenario,
  runScenario,
  enableAndGetAgentApp,
} from "@holochain/tryorama";
import {
  AgentPubKey,
  AppRoleManifest,
  AppWebsocket,
  Record,
  WsClient,
  encodeHashToBase64,
} from "@holochain/client";
import { decode } from "@msgpack/msgpack";
import { Base64 } from "js-base64";

const hAppPath = process.cwd() + "/../workdir/requests_and_offers.happ";
const appSource = {
  appBundleSource: {
    type: "path" as const,
    value: hAppPath,
  },
};

export type DnaProperties = {
  progenitor_pubkey: string;
};

export async function runScenarioWithTwoAgents(
  callback: (
    scenario: Scenario,
    alice: PlayerApp,
    bob: PlayerApp,
  ) => Promise<void>,
): Promise<void> {
  await runScenario(async (scenario) => {
    // Pre-generate alice's pubkey so it can be embedded as the progenitor in
    // the DNA properties before installing the app. This ensures alice is
    // automatically registered as the first network administrator when she
    // calls create_user — no explicit registerNetworkAdministrator needed.
    const aliceConductor = await scenario.addConductor();
    const alicePubKey = await aliceConductor.adminWs().generateAgentPubKey();
    const testNetworkSeed = `test_${Date.now()}`;

    const progenitorRolesSettings = {
      requests_and_offers: {
        type: "provisioned" as const,
        value: {
          modifiers: {
            properties: { progenitor_pubkey: encodeHashToBase64(alicePubKey) },
          },
        },
      },
    };

    const aliceAppInfo = await aliceConductor.installApp({
      appBundleSource: { type: "path", value: hAppPath },
      options: {
        agentPubKey: alicePubKey,
        networkSeed: testNetworkSeed,
        rolesSettings: progenitorRolesSettings,
      },
    });
    const aliceAdminWs = aliceConductor.adminWs();
    const alicePort = await aliceConductor.attachAppInterface();
    const aliceIssued = await aliceAdminWs.issueAppAuthenticationToken({
      installed_app_id: aliceAppInfo.installed_app_id,
    });
    const aliceAppWs = await aliceConductor.connectAppWs(
      aliceIssued.token,
      alicePort,
    );
    const aliceAgentApp = await enableAndGetAgentApp(
      aliceAdminWs,
      aliceAppWs,
      aliceAppInfo,
    );
    const alice: PlayerApp = {
      conductor: aliceConductor,
      appWs: aliceAppWs,
      ...aliceAgentApp,
    };

    const bob = await scenario.addPlayerWithApp({
      appBundleSource: { type: "path", value: hAppPath },
      options: {
        networkSeed: testNetworkSeed,
        rolesSettings: progenitorRolesSettings,
      },
    });

    await scenario.shareAllAgents();

    console.log("Running scenario with Alice (progenitor) and Bob");

    await callback(scenario, alice, bob);

    scenario.cleanUp();
  });
}

/**
 * Runs a Tryorama scenario with a pre-configured progenitor agent (alice).
 *
 * Alice's agent pubkey is generated before app installation so it can be
 * embedded in the DNA properties as the `progenitor_pubkey`. Both alice and
 * bob install the same app bundle with the same network seed so they share
 * the same DHT space.
 *
 * @param callback - Receives (scenario, alice, bob, alicePubKey) as arguments.
 */
export async function runScenarioWithProgenitor(
  callback: (
    scenario: Scenario,
    alice: PlayerApp,
    bob: PlayerApp,
    alicePubKey: AgentPubKey,
  ) => Promise<void>,
): Promise<void> {
  await runScenario(async (scenario) => {
    // Step 1: Create alice's conductor and pre-generate her pubkey so we can
    // embed it in the DNA properties before installing the app.
    const aliceConductor = await scenario.addConductor();
    const alicePubKey = await aliceConductor.adminWs().generateAgentPubKey();

    // Unique seed ensures alice and bob are on the same isolated DHT space.
    const testNetworkSeed = `progenitor_test_${Date.now()}`;

    const progenitorRolesSettings = {
      requests_and_offers: {
        type: "provisioned" as const,
        value: {
          modifiers: {
            properties: { progenitor_pubkey: encodeHashToBase64(alicePubKey) },
          },
        },
      },
    };

    // Step 2: Install the app for alice using her pre-generated pubkey and
    // the progenitor DNA property set to her key.
    const aliceAppInfo = await aliceConductor.installApp({
      appBundleSource: { type: "path", value: hAppPath },
      options: {
        agentPubKey: alicePubKey,
        networkSeed: testNetworkSeed,
        rolesSettings: progenitorRolesSettings,
      },
    });

    const aliceAdminWs = aliceConductor.adminWs();
    const alicePort = await aliceConductor.attachAppInterface();
    const aliceIssued = await aliceAdminWs.issueAppAuthenticationToken({
      installed_app_id: aliceAppInfo.installed_app_id,
    });
    const aliceAppWs = await aliceConductor.connectAppWs(
      aliceIssued.token,
      alicePort,
    );
    const aliceAgentApp = await enableAndGetAgentApp(
      aliceAdminWs,
      aliceAppWs,
      aliceAppInfo,
    );
    const alice: PlayerApp = {
      conductor: aliceConductor,
      appWs: aliceAppWs,
      ...aliceAgentApp,
    };

    // Step 3: Install the same app for bob on the same network seed (same DHT)
    // with the same progenitor DNA property so the integrity validation passes.
    const bob = await scenario.addPlayerWithApp({
      appBundleSource: { type: "path", value: hAppPath },
      options: {
        networkSeed: testNetworkSeed,
        rolesSettings: progenitorRolesSettings,
      },
    });

    await scenario.shareAllAgents();

    console.log("Running progenitor scenario with Alice (progenitor) and Bob");

    await callback(scenario, alice, bob, alicePubKey);

    scenario.cleanUp();
  });
}

/**
 * Decodes a set of records using MessagePack.
 * @param records The records to decode.
 * @returns {T[]} The decoded records.
 */
export function decodeRecords<T>(records: Record[]): T[] {
  return records.map((r) => decode((r.entry as any).Present.entry)) as T[];
}

export function decodeRecord<T>(record: Record): T {
  return decode((record.entry as any).Present.entry) as T;
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

  const wasmErrorTypeRegex = /type:\s*(\w+)/; // Fixed: Match word characters after 'type:' with optional whitespace
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

export function imagePathToArrayBuffer(
  imagePath: string,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    fs.readFile(imagePath, (err, buffer) => {
      if (err) {
        reject(err);
        return;
      }

      // Convert Buffer to ArrayBuffer
      const arrayBuffer = Uint8Array.from(buffer).buffer;

      resolve(arrayBuffer as ArrayBuffer);
    });
  });
}
