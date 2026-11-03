# Web development mode

`bun start:web` runs the app in plain browser tabs instead of the hc-spin Electron windows that `bun start` opens. Each member gets its own URL, Vite reloads the page as you edit, and the browser's own dev tools and extensions work as usual.

```bash
nix develop
bun start:web             # two members
AGENTS=3 bun start:web    # three members
```

It builds the hApp, then prints one URL per member and the inspector's, and opens each in the default browser:

```
[web] ready: 2 member(s), network seed web-dev-1793660000000
[web]   member A  http://localhost:8880/?hcPort=…&hcToken=…&hcAdminPort=…
[web]   member B  http://127.0.0.1:8880/?hcPort=…&hcToken=…&hcAdminPort=…
[web]   inspector http://localhost:56102/
```

Set `WEB_OPEN=0` to print the URLs without opening anything, for a headless run or CI.

Member A is on `localhost` and member B on `127.0.0.1`: two origins to the browser, so their storage stays apart even in one profile. A third member or more shares `localhost`; open it in its own browser profile or private window. Ctrl-C stops everything and deletes the sandbox.

## What it starts

- A local `kitsune2-bootstrap-srv`, the only bootstrap the conductor knows, so the members find each other there and nowhere else.
- One `hc sandbox` conductor in `/tmp/rao-web-<admin port>`. The launcher asks for the `mem` network, but under Holochain 0.7 the conductor runs the iroh transport and registers with a public relay: its `conductor-config.yaml` carries `relay_url: https://use1-1.relay.n0.iroh-canary.iroh.link./`, and `dumpNetworkStats` reports backend `iroh` with that relay as its peer URL. What keeps anyone else out is the network seed: each run makes a fresh one, so no other conductor runs the same DNAs, and the members are announced only to the local bootstrap server. Between the two members, the records synced with zero transport connections open, since both agents live in this one conductor. Its `.hc` index is written there too, so the project root's `.hc` (used by `bun start` and the e2e suite) is left alone.
- The hApp installed once per member, as `requests_and_offers`, `requests_and_offers_b`, `requests_and_offers_c` and so on, each with its own agent key, all on one network seed that is new on every run.
- One Vite dev server for the UI.
- The inspector page, served by the launcher itself (below).

The URL carries what `HolochainClientService` reads (`ui/src/lib/services/HolochainClientService.svelte.ts`): `hcPort` and `hcToken` to connect to the conductor's app interface, and `hcAdminPort` so a plain browser, which has no host signer, can get zome-call signing credentials. It authorizes signing only for that member's own cells, not the other members' cells on the same conductor.

Only the first load carries them: any navigation inside the app drops the query. So the tab keeps them in its `sessionStorage` (`ui/src/lib/utils/dev-connection-params.ts`), and a reload on any route, `/offers` or `/admin/users`, reconnects as the same member. `sessionStorage` belongs to one tab and one origin, so two members' tabs never share it. A URL that carries the params always wins, so opening a member's printed URL again replaces what that tab had stored. A new tab opened on a bare address such as `http://localhost:8880/offers` has nothing stored and cannot connect: open the member's printed URL instead.

## Ports

| Variable | Default | Used for |
| --- | --- | --- |
| `AGENTS` | 2 | members, from 1 to 26 |
| `UI_PORT` | 8880 | Vite |
| `ADMIN_PORT` | a free port | the conductor's admin interface, and the sandbox directory name |
| `BOOTSTRAP_PORT` | a free port | the local bootstrap server |
| `INSPECTOR_PORT` | a free port | the inspector page, on `127.0.0.1` only |
| `WEB_OPEN` | opens | `0` prints the URLs without opening them |

Two stacks can run side by side as long as their `UI_PORT` differ.

## The inspector

The inspector shows what the conductor holds, member by member:

- each member's app id, agent key and status;
- each of its cells (`requests_and_offers` and `hrea`) by DNA hash;
- per cell, the source chain: its length, the ops it has published, and its latest actions with their type, entry type and time;
- per cell, the DHT state from `dumpFullState`: ops integrated against those still in validation or integration limbo, and the integrated ops by kind, plus the peers the cell knows;
- for the whole conductor, the transport and its connections from `dumpNetworkStats`.

It refreshes every five seconds, or on its Refresh button. It is read-only: it lists and dumps, and never grants, installs or changes anything.

It is a dev-only surface. The launcher serves it from Node on `127.0.0.1` (`scripts/inspector.html` and `scripts/inspector.mts`), reading through the admin connection it already holds. Nothing of it is in the UI build or the desktop package.

It replaces `hc playground`, which `bun start` used to launch and the flake used to pin. That playground could not show this conductor's data:

- The only build the flake could pin was `hc-playground` 0.500.0, a Holochain 0.5 build.
- Pointed at a 0.7 conductor, it stays on "Connecting to conductors..." while the page throws `Cannot read properties of undefined (reading 'author')`. That is the 0.7 split of an Action into header and data.
- Upstream (`darksoil-studio/holochain-playground`) has no 0.7 build: its newest branch is `main-0.6`, still 0.500.0.

So `bun start` no longer launches it, and the flake no longer pins it.

## Walking an exchange between two members

Found on the first two-member run (#419):

- **Reload after approval.** When the administrator accepts a member, that member's tab keeps the cached "pending" status until it reloads its own URL.
- **An offer before a Service Exchange proposal.** When the listing's medium is Service Exchange, the member who proposes must already have an offer of their own, or Send proposal stays disabled.

## What this does not cover

- **The desktop path.** The Kangaroo/Electron app and `bun start` (hc-spin) inject the connection through their launcher and sign zome calls with the host's signer; here a plain browser gets signing credentials through `hcAdminPort` instead. Window handling and storage also differ. A change that touches connection, signing, windows or storage is exercised only by `bun start` or the desktop build, so check it there before a release.
- **More than one machine.** The bootstrap server listens on `127.0.0.1` and the network seed is fresh per run, so every member lives on this machine, even though the conductor is configured with the public iroh relay. Two developers each run their own stack; they do not join one another's.

## Notes

- The launcher (`scripts/start-web.mts`) runs under Node, not Bun: `@holochain/client`'s `AdminWebsocket` handshake fails under Bun with "Expected 101" and succeeds under Node. Its pure parts are in `scripts/web-dev.mts` and `scripts/inspector.mts`, tested by `bun test scripts/tests`. The inspector's tests read a capture from a real 0.7 conductor (`scripts/tests/fixtures/inspector-dump.json`).
- Data does not survive a restart: every run is a new sandbox and a new network seed. That is the point for development; use `bun start` or the desktop app to keep data.
- Set `WEB_VERBOSE=1` to see the conductor's log.
