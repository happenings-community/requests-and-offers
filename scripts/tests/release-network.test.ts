import { describe, expect, it } from "bun:test";
import {
  compareNetwork,
  edgeNodeConfig,
  networkNotice,
  type NetworkManifest,
} from "../release-network.ts";

const manifest = (
  overrides: Partial<NetworkManifest["desktop"]> = {},
): NetworkManifest => ({
  version: "0.6.0-alpha.3",
  tag: "v0.6.0-alpha.3",
  holochainVersion: "0.7.0",
  happ: { file: "requests_and_offers.happ", sha256: "a".repeat(64) },
  dna: { hash: "uhC0kDNA" },
  desktop: {
    networkSeed: "alpha2-holochain07-2026",
    bootstrapUrl: "https://dev-test-bootstrap2.holochain.org/",
    relayUrl: "https://iroh-relay-hc.holochain.org/",
    installedDnaHashes: { requests_and_offers: "uhC0kRO", hrea: "uhC0kHREA" },
    ...overrides,
  },
});

describe("compareNetwork", () => {
  it("is the same network when every installed DNA hash matches", () => {
    expect(compareNetwork(manifest(), manifest(), "v0.6.0-alpha.2")).toEqual({
      status: "same",
      previousTag: "v0.6.0-alpha.2",
      changedRoles: [],
    });
  });

  it("is a new network when one role moved, and names the role", () => {
    const previous = manifest({
      installedDnaHashes: {
        requests_and_offers: "uhC0kOLD",
        hrea: "uhC0kHREA",
      },
    });
    expect(compareNetwork(manifest(), previous, "v0.6.0-alpha.2")).toEqual({
      status: "new",
      previousTag: "v0.6.0-alpha.2",
      changedRoles: ["requests_and_offers"],
    });
  });

  // The case dna.hash alone misses: same code, new seed. The installed hash is
  // computed with the seed applied, so it moves; the DNA file hash does not.
  it("is a new network when only the seed changed and the DNA file is identical", () => {
    const previous = manifest({
      networkSeed: "alpha1-iroh-2026",
      installedDnaHashes: {
        requests_and_offers: "uhC0kSEED1",
        hrea: "uhC0kSEED2",
      },
    });
    const result = compareNetwork(manifest(), previous, "v0.6.0-alpha.2");
    expect(result.status).toBe("new");
    expect(result.changedRoles).toEqual(["requests_and_offers", "hrea"]);
  });

  it("is unknown when there is no previous manifest, never same", () => {
    expect(compareNetwork(manifest(), undefined, "v0.6.0-alpha.1")).toEqual({
      status: "unknown",
      previousTag: "v0.6.0-alpha.1",
      changedRoles: [],
    });
  });

  it("is unknown when the previous manifest predates installed hashes", () => {
    const previous = {
      ...manifest(),
      desktop: { networkSeed: "x" },
    } as unknown as NetworkManifest;
    expect(compareNetwork(manifest(), previous, "v0.6.0-alpha.1").status).toBe(
      "unknown",
    );
  });

  it("is unknown when there is no previous release at all", () => {
    expect(compareNetwork(manifest(), undefined, undefined).status).toBe(
      "unknown",
    );
  });
});

describe("networkNotice", () => {
  it("tells operators to move, and names the seed, on a new network", () => {
    const notice = networkNotice(
      {
        status: "new",
        previousTag: "v0.6.0-alpha.2",
        changedRoles: ["requests_and_offers"],
      },
      manifest(),
    );
    expect(notice).toContain("New network");
    expect(notice).toContain("v0.6.0-alpha.2");
    expect(notice).toContain("`alpha2-holochain07-2026`");
    expect(notice).toContain("edge-node-config.json");
  });

  it("says plainly that nothing moved on the same network", () => {
    const notice = networkNotice(
      { status: "same", previousTag: "v0.6.0-alpha.2", changedRoles: [] },
      manifest(),
    );
    expect(notice).toContain("Same network as v0.6.0-alpha.2");
    expect(notice).not.toContain("New network");
  });

  it("does not claim continuity it could not measure", () => {
    const notice = networkNotice(
      { status: "unknown", previousTag: "v0.6.0-alpha.1", changedRoles: [] },
      manifest(),
    );
    expect(notice).not.toContain("Same network");
    expect(notice).toContain("v0.6.0-alpha.1");
    expect(notice).toContain("`alpha2-holochain07-2026`");
  });
});

describe("edgeNodeConfig", () => {
  const repo = "happenings-community/requests-and-offers";

  it("points at this release happ asset and pins its digest", () => {
    const config = edgeNodeConfig(manifest(), repo);
    expect(config.app.happUrl).toBe(
      "https://github.com/happenings-community/requests-and-offers/releases/download/v0.6.0-alpha.3/requests_and_offers.happ",
    );
    expect(config.app.happSha256).toBe("a".repeat(64));
    expect(config.app.version).toBe("0.6.0-alpha.3");
  });

  it("carries the desktop seed, bootstrap and relay, so an operator cannot land on another network", () => {
    const config = edgeNodeConfig(manifest(), repo);
    expect(config.app.modifiers.networkSeed).toBe("alpha2-holochain07-2026");
    expect(config.env.holochain.bootstrapUrl).toBe(
      "https://dev-test-bootstrap2.holochain.org/",
    );
    expect(config.env.holochain.relayUrl).toBe(
      "https://iroh-relay-hc.holochain.org/",
    );
    expect(config.env.holochain.version).toBe("0.7.0");
  });

  // Holochain 0.7 edge nodes use iroh only; Holo's USAGE.md says the older
  // signal and STUN fields are ignored, so writing them would only mislead.
  it("writes no 0.6 signal or STUN fields", () => {
    const json = JSON.stringify(edgeNodeConfig(manifest(), repo));
    expect(json).not.toContain("signalServerUrl");
    expect(json).not.toContain("stunServerUrls");
  });

  it("refuses a manifest with no desktop seed rather than write an empty one", () => {
    expect(() => edgeNodeConfig(manifest({ networkSeed: "" }), repo)).toThrow(
      /networkSeed/,
    );
  });

  it("refuses a manifest with no relay or bootstrap", () => {
    expect(() => edgeNodeConfig(manifest({ relayUrl: "" }), repo)).toThrow(
      /relayUrl/,
    );
    expect(() => edgeNodeConfig(manifest({ bootstrapUrl: "" }), repo)).toThrow(
      /bootstrapUrl/,
    );
  });
});
