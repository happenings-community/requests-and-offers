# A standalone conductor inspector

Design note, 2026-11-02. Status: proposed. The inspector began inside Requests and Offers (#434) because `hc playground` cannot read a Holochain 0.7 conductor. This note says how to lift it into a tool any 0.7 hApp can use, Nondominium first.

## What exists in R&O

#434 leaves the inspector in two layers.

| Layer | Files | Knows |
| --- | --- | --- |
| Core | `scripts/inspector-server.mts`, `inspector-graph.mts`, `inspector-view.mts`, `inspector-types.mts`, `inspector.html` | Holochain 0.7 only: admin API calls, actions, entries, links, ops, peers |
| Adapter | `scripts/inspector-adapter.mts` (`roAdapter`) | R&O: entry and link type names, role labels and colours, title, the role to open on |
| Launch | `scripts/start-web.mts`, `inspector-serve.mts`, `free-ports.mts` | how R&O starts its conductors |

A test (`scripts/tests/inspector-adapter.test.ts`) fails if an R&O or hREA name appears in a core file. With `genericAdapter`, the inspector already works on any hApp: types show by index (`zome_resource #2`), roles by their manifest names.

## The tool

**Name:** `holo-inspector` (working name; the package name is the open question below).

**Home:** its own repository, `happenings-community/holo-inspector`. Soushi can redirect it, to the Holochain community's tooling for instance.

**Use:**

```bash
bunx holo-inspector --admin 41001,41002            # one or more conductors by admin port
bunx holo-inspector --hc-sandbox .hc               # the ports `hc sandbox` recorded
bunx holo-inspector --admin 41001 --adapter ./inspector.config.ts
```

It serves the page on `127.0.0.1`, prints the URL, opens it unless `--no-open`, and reads each conductor on the page's first request after it is up, so it can start beside `hc-spin` in a `concurrently` line, the way R&O's `bun start` runs it.

**Adapter file:** optional, a TypeScript or JSON module exporting the `InspectorAdapter` shape that R&O already uses (`title`, `roles`, `defaultRole`, `zomeNames`). The tool ships one generic helper for the common case: `zomeNamesFromSource(dir)`, which reads `pub enum EntryTypes` and `pub enum LinkTypes` from each integrity zome's `lib.rs` under a directory, as R&O does today (`enumVariants`). hREA's tables go in the tool as a ready adapter fragment, since several hApps (R&O, Nondominium) embed it.

**Packaging:** one npm package, versioned with semver and tagged against the Holochain minor it reads (`0.7.x` today), with `@holochain/client` and `cytoscape` pinned as dependencies. A `bin` entry runs under Node: `@holochain/client`'s `AdminWebsocket` handshake fails under Bun ("Expected 101"), so `bunx` must start Node, not Bun. The page's view module is served with its types stripped by `node:module` (Node 22.13 or later), so the package ships TypeScript sources and needs no build step.

## The Nondominium trial

Read from `Sensorica/nondominium` at `7faf650`:

- **Roles:** `lobby`, `nondominium`, `hrea`, `group`, `ndo`. `group` and `ndo` are deferred and cloned on demand (`clone_limit` 64 and 512).
- **Integrity zomes:** `zome_lobby_integrity`, `zome_person`, `zome_resource`, `zome_gouvernance`, `zome_group_integrity`, plus hREA's. Their names do not end in `_integrity`, so R&O's source path rule does not carry over; `zomeNamesFromSource` must map zome name to crate directory from the DNA manifest, not by suffix.
- **Launch:** `npm start` still runs `hc playground` beside `scripts/launch-happ.mjs`, which has the same 0.5-against-0.7 problem R&O had. The trial replaces it with the inspector, given the admin ports `launch-happ.mjs` uses.

**What the trial needs from the core first:** clone cells. The core keys a cell by `appId/role`, so two `ndo` clones of one member overwrite each other. Keying by cell id (with the clone id as label) fixes it, and the network view then shows one node per clone. Nothing else in the core is R&O-shaped.

## What is missing for Holochain 0.7 in general

- **Type names.** No admin call returns entry or link type names, only their indexes. Every hApp needs either source access or an adapter. Exposing names in the DNA definition would be a Holochain change.
- **Clone cells,** as above.
- **Private entries.** Not yet checked: whether `dumpFullState` returns a member's private entries (Nondominium's `PrivateParticipationClaim` is one). If it does, the page shows them to whoever runs it, and a shared screenshot carries them; the tool should then mark private entries and offer to hide them. The trial settles it.
- **Scale.** The page reads every record on every refresh (3 s). Fine for a dev network of a few hundred records; a long-running network needs `dumpFullState` paging or a diff since the last capture.
- **Bun.** The tool runs under Node until `@holochain/client`'s websocket works under Bun.

## Open questions for Soushi

- The name and the home repository.
- The licence: R&O is CAL-1.0; a development tool other hApps install may be better served by a permissive one.
- Whether hREA's adapter fragment lives in the tool or in hREA itself, which would also serve the hREA explorer.
- Whether R&O keeps its copy until the tool is published, or switches to the package as soon as Nondominium's trial passes.
