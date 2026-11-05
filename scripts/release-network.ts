#!/usr/bin/env bun
/**
 * release-network.ts — say whether a release moves the network, and hand edge
 * node operators a config they cannot get wrong.
 *
 * WHY THIS EXISTS
 *
 * Edge nodes back up the desktop testers' network. When a release changes that
 * network, a node left on the old one keeps running, reports itself healthy,
 * and serves nobody. We keep no list of operators to warn, so the release
 * itself has to say it, in its title and its note, and the node has to be able
 * to install the right thing in one command (Sam, #277, 23 October).
 *
 * WHICH HASH DECIDES "NEW NETWORK"
 *
 * Not `dna.hash`. That is the DNA file before any modifier, so it stays put
 * when only the seed changes, and a seed change is a new network just the
 * same. `desktop.installedDnaHashes` is the hash of each cell as a desktop
 * install runs it, seed applied, so it moves on either change. A role whose
 * installed hash differs from the previous release's is on a new network.
 *
 * Without a previous manifest to compare against the answer is `unknown`,
 * never `same`: a note that claims continuity it did not measure is how an
 * operator stays on a dead network.
 *
 * THE EDGE NODE CONFIG
 *
 * Holo's Edge Node installs a hApp from a JSON file (`install_happ`), whose
 * shape is in Holo-Host/edgenode USAGE.md and its `docker/ziptest-realsha.json`
 * fixture: `app.happUrl`, `app.happSha256`, `app.modifiers.networkSeed`,
 * `env.holochain.{version, bootstrapUrl, relayUrl}`. Holochain 0.7 uses iroh
 * only, so the 0.6 `signalServerUrl` and `stunServerUrls` are not written.
 * Seed, bootstrap and relay all come from the desktop wrapper, because a node
 * that matches the seed but not the bootstrap is just as alone.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

/** The fields of release-manifest.json this script reads. */
export type NetworkManifest = {
  version: string;
  tag: string;
  holochainVersion: string;
  happ: { file: string; sha256: string };
  dna: { hash: string };
  desktop: {
    networkSeed: string;
    bootstrapUrl: string;
    relayUrl: string;
    installedDnaHashes: Record<string, string>;
  };
};

export type NetworkComparison = {
  status: "new" | "same" | "unknown";
  previousTag: string | undefined;
  changedRoles: string[];
};

export const compareNetwork = (
  current: NetworkManifest,
  previous: NetworkManifest | undefined,
  previousTag: string | undefined,
): NetworkComparison => {
  const before = previous?.desktop?.installedDnaHashes;
  if (!before || typeof before !== "object") {
    return { status: "unknown", previousTag, changedRoles: [] };
  }
  const changedRoles = Object.entries(current.desktop.installedDnaHashes)
    .filter(([role, hash]) => before[role] !== hash)
    .map(([role]) => role);
  return {
    status: changedRoles.length > 0 ? "new" : "same",
    previousTag,
    changedRoles,
  };
};

/** Appended to the release title, so the releases feed says it without opening the note. */
export const titleSuffix = (comparison: NetworkComparison): string =>
  comparison.status === "new" ? " (new network)" : "";

export const networkNotice = (
  comparison: NetworkComparison,
  manifest: NetworkManifest,
): string => {
  const seed = `\`${manifest.desktop.networkSeed}\``;
  const previous = comparison.previousTag ?? "the previous release";
  switch (comparison.status) {
    case "new":
      return (
        `**New network.** This release does not join ${previous}'s network ` +
        `(changed: ${comparison.changedRoles.join(", ")}). Edge nodes must reinstall on seed ${seed}: ` +
        "`install_happ edge-node-config.json` with the config attached to this release."
      );
    case "same":
      return `**Same network as ${previous}.** Edge nodes on seed ${seed} keep running; updating the hApp is optional.`;
    case "unknown":
      return (
        `**Network not compared.** ${previous} published no manifest to compare against, so this note cannot ` +
        `say whether the network moved. Run edge nodes on seed ${seed}, with the config attached to this release.`
      );
  }
};

export type EdgeNodeConfig = {
  app: {
    name: string;
    version: string;
    happUrl: string;
    happSha256: string;
    modifiers: { networkSeed: string; properties: string };
  };
  env: {
    holochain: {
      version: string;
      flags: string[];
      bootstrapUrl: string;
      relayUrl: string;
    };
  };
};

export const edgeNodeConfig = (
  manifest: NetworkManifest,
  repo: string,
): EdgeNodeConfig => {
  const { networkSeed, bootstrapUrl, relayUrl } = manifest.desktop;
  for (const [name, value] of Object.entries({
    networkSeed,
    bootstrapUrl,
    relayUrl,
  })) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(
        `the manifest has no desktop.${name}, so an edge node config would put the node on no network`,
      );
    }
  }
  return {
    app: {
      name: "requests-and-offers",
      version: manifest.version,
      happUrl: `https://github.com/${repo}/releases/download/${manifest.tag}/${manifest.happ.file}`,
      happSha256: manifest.happ.sha256,
      modifiers: { networkSeed, properties: "" },
    },
    env: {
      holochain: {
        version: manifest.holochainVersion,
        flags: [],
        bootstrapUrl,
        relayUrl,
      },
    },
  };
};

const flag = (argv: string[], name: string, fallback?: string): string => {
  const index = argv.indexOf(`--${name}`);
  if (index === -1 || !argv[index + 1]) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing --${name}`);
  }
  return argv[index + 1];
};

if (import.meta.main) {
  const argv = Bun.argv.slice(2);
  const manifest = JSON.parse(
    readFileSync(flag(argv, "manifest"), "utf8"),
  ) as NetworkManifest;
  const previousPath = flag(argv, "previous-manifest", "");
  const previous =
    previousPath && existsSync(previousPath)
      ? (JSON.parse(readFileSync(previousPath, "utf8")) as NetworkManifest)
      : undefined;
  const previousTag = flag(argv, "previous-tag", "") || undefined;
  const comparison = compareNetwork(manifest, previous, previousTag);

  writeFileSync(
    flag(argv, "config-out"),
    `${JSON.stringify(edgeNodeConfig(manifest, flag(argv, "repo")), null, 2)}\n`,
  );
  writeFileSync(
    flag(argv, "comparison-out"),
    `${JSON.stringify({ ...comparison, titleSuffix: titleSuffix(comparison), notice: networkNotice(comparison, manifest) }, null, 2)}\n`,
  );
  console.log(JSON.stringify(comparison));
}
