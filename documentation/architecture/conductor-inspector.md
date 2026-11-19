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

### The entry graph's layout and view

The layout is computed in `inspector-view.mts`, not by a Cytoscape force layout, so it needs no extension and is tested like the rest of the view logic.

- **Clustered by entry type.** `clusteredLayout` gives each entry type one block, framed by a compound node labelled with the type and its count (a block of one node, such as a collapsed group, has no frame). Records sit on a grid inside their block, in creation order, one cell (150 by 58 model pixels) each, wider than the longest label the page draws (110 pixels, then an ellipsis), so nodes and their labels never touch and types never mix.
- **Blocks that point at each other sit together.** `typeOrder` lays first the type with the most edges to other types, then always the type most connected to those already laid; the blocks are packed into rows, trying every row width the blocks allow (the first one, two, three side by side) and keeping the packing whose overall shape is closest to a 1.6 aspect ratio, the graph pane's usual shape, so two blocks sit side by side rather than one above the other.
- **Deterministic.** The positions are a pure function of what is on screen: the same records give the same positions, in any order they arrive. A Live refresh that changes nothing moves nothing; one that adds a record puts it at the end of its type's block and animates the few records that have to make room. A record the reader drags keeps his place until Re-layout.
- **Auto-fit,** on by default, toggled by the button beside Fit. While on, the view refits after anything that changes what is on the graph or the room it has: a DNA switch, a type chip, Hide unlinked, Group large types, the author filter, Re-layout, a refresh that adds or removes records, a group opened or closed, and a resize of the window or a panel. A search fits the matches, and everything again once it is cleared. A refit after records move waits until they have arrived, so it measures the final box. Any pan or zoom by the reader (wheel, drag, pinch, a double-click focus, Zoom to selection, a record centred from the chain or the detail) turns it off, and the button reads "Auto-fit off", so the view never moves under him. F, the Fit button, Esc and the toggle turn it back on. The rules are `autoFit` in `inspector-view.mts`.
- **The fit** (`fitView`) keeps 36 screen pixels clear around the graph and never zooms past 1.25, so a graph of three records does not fill the pane.
- **Zoom.** The page handles the wheel itself (`wheelZoom`), before Cytoscape's handler: the zoom changes by `exp(-0.002 × deltaY)` per event, centred on the cursor, so a trackpad's small events glide and a mouse notch steps about 18 percent; a trackpad pinch (a wheel event with `ctrlKey`) gets a gain of 0.01; line-mode wheels count 16 pixels per line; one event never more than doubles or halves the zoom; a sideways swipe pans. The zoom stays between 0.1 and 3. The network panel uses the same wheel.

## The adapter contract

An adapter is everything the conductor cannot tell the inspector. The contract is the one `scripts/inspector-adapter.mts` and `scripts/inspector-types.mts` define today, unchanged:

```ts
type ZomeNames = (zome: string) => { entries: string[]; links: string[] } | null;

type InspectorAdapter = {
  title: string;
  /** Per role name, as the hApp manifest calls it: a label and an optional colour. */
  roles: Record<string, { label: string; colour?: string }>;
  /** The role the entry graph opens on; the first role otherwise. */
  defaultRole?: string;
  zomeNames: ZomeNames;
};
```

- `zomeNames` is called once per integrity zome, by the zome name the DNA definition gives. It returns that zome's `EntryTypes` and `LinkTypes` variants in declaration order, because an action carries only their indexes; `null` means "unknown", and the page falls back to `zome #index`.
- `roles` and `defaultRole` only label and colour; a role missing from the map shows under its manifest name.
- The page receives `InspectorConfig`, the adapter without `zomeNames`: names are resolved on the server, so an adapter can read source files and never ships them to the browser.
- `genericAdapter` (`{ title: 'Conductor inspector', roles: {}, zomeNames: () => null }`) is the floor every hApp gets with no adapter at all.

R&O's `roAdapter` is the worked example: two roles with colours, hREA's tables for `hrea_integrity`, and `enumVariants` over each R&O integrity zome's `lib.rs` for the rest.

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

### Packaging options

The recommendation above is the first row. The others were weighed against it:

| Option | How a hApp uses it | For | Against |
| --- | --- | --- | --- |
| npm package with a `bin` (recommended) | `bunx holo-inspector …` or a dev dependency in the `network` script | one install path for every JavaScript hApp; versions pin per hApp; the adapter is a local file | needs Node 22.13+ on the machine; publishing needs an npm owner |
| `bunx` / `npx` from the repository, no publish | `bunx github:<org>/holo-inspector …` | no registry account; usable the day the repository exists | no semver range, so a hApp pins a commit; slower first run |
| Single binary (Node single-executable application) | download one file per platform | no Node install for the user | the page's assets and Cytoscape have to be embedded; one build per platform; not tried |
| Nix flake output | `nix run github:<org>/holo-inspector` inside a holonix shell | fits Holochain's own toolchain (holonix), which R&O and Nondominium both use | the flake must pin Node; non-Nix users get nothing |
| Vendored copy (today) | copy `scripts/inspector*` into the hApp | no dependency at all | every hApp drifts from every other; this is the state the extraction ends |

The first two are one artefact, published or not, so the repository can start with the second and add the first once the name and licence are settled. The Nix output can wrap the same package later.

## The Nondominium trial

Read from `Sensorica/nondominium` at `7faf650`:

- **Roles:** `lobby`, `nondominium`, `hrea`, `group`, `ndo`. `group` and `ndo` are deferred and cloned on demand (`clone_limit` 64 and 512).
- **Integrity zomes:** `zome_lobby_integrity`, `zome_person`, `zome_resource`, `zome_gouvernance`, `zome_group_integrity`, plus hREA's. Their names do not end in `_integrity`, so R&O's source path rule does not carry over; `zomeNamesFromSource` must map zome name to crate directory from the DNA manifest, not by suffix.
- **Launch:** `npm start` still runs `hc playground` beside `scripts/launch-happ.mjs`, which has the same 0.5-against-0.7 problem R&O had. The trial replaces it with the inspector, given the admin ports `launch-happ.mjs` uses.

**Steps:**

1. **Clone cells in the core,** in R&O first: key a cell by cell id with the clone id as its label (below), with a test on a fixture holding two clones of one role. R&O's own view must not change.
2. **Lift the core** into the new repository with its tests and fixtures, plus `genericAdapter`, `zomeNamesFromSource(dir)` and hREA's tables as a fragment. R&O's copy stays until step 6.
3. **A Nondominium adapter** (`inspector.config.ts` in Nondominium): roles `lobby`, `nondominium`, `hrea`, `group`, `ndo`; `zomeNamesFromSource` pointed at `dnas/`, mapping zome name to crate through the DNA manifests; hREA's fragment for `hrea`.
4. **Wire it into `network`:** replace `"hc playground"` in Nondominium's `network` script with the inspector, reading the admin ports from `ui/static/hc-connection.json`, where `scripts/launch-happ.mjs` writes each agent's `adminWsUrl` (read at `dev` `7faf6507`). An `--hc-connection <file>` flag, or the adapter returning the ports, are the two ways to pass them.
5. **Run it with two agents** and check: every role shows, clones show one node each, entry and link names resolve for every Nondominium zome, and whether private entries appear (below). Record the answers on #438.
6. **Switch R&O** to the package once the trial passes, deleting its copy in the same PR.

**What the trial needs from the core first:** clone cells. The core keys a cell by `appId/role`, so two `ndo` clones of one member overwrite each other. Keying by cell id (with the clone id as label) fixes it, and the network view then shows one node per clone. Nothing else in the core is R&O-shaped.

## What is missing for Holochain 0.7 in general

- **Type names.** No admin call returns entry or link type names, only their indexes. Every hApp needs either source access or an adapter. Exposing names in the DNA definition would be a Holochain change.
- **Clone cells,** as above.
- **Private entries.** Not yet checked: whether `dumpFullState` returns a member's private entries (Nondominium's `PrivateParticipationClaim` is one). If it does, the page shows them to whoever runs it, and a shared screenshot carries them; the tool should then mark private entries and offer to hide them. The trial settles it.
- **Scale.** The page reads every record on every refresh (3 s). Fine for a dev network of a few hundred records; a long-running network needs `dumpFullState` paging or a diff since the last capture.
- **Bun.** The tool runs under Node until `@holochain/client`'s websocket works under Bun.

Tracked in #438.

## Open questions for Soushi

- The name and the home repository.
- **The licence (Soushi's decision).** R&O is CAL-1.0 (`package.json`), and the inspector was written inside it, so CAL-1.0 is what the extracted code carries until Soushi decides otherwise. A development tool that other hApps install may be better served by a permissive licence (MIT or Apache-2.0, for instance); relicensing code written in R&O is Soushi's call, and the repository should not be published before it is made.
- Whether hREA's adapter fragment lives in the tool or in hREA itself, which would also serve the hREA explorer.
- Whether R&O keeps its copy until the tool is published, or switches to the package as soon as Nondominium's trial passes.
