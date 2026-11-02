# Web development mode

`bun start:web` runs the app in plain browser tabs instead of the hc-spin Electron windows that `bun start` opens. Each member gets its own URL, Vite reloads the page as you edit, and the browser's own dev tools and extensions work as usual.

```bash
nix develop
bun start:web             # two members
AGENTS=3 bun start:web    # three members
```

It builds the hApp, then prints one URL per member:

```
[web] ready: 2 member(s), network seed web-dev-1793660000000
[web]   member A  http://localhost:8880/?hcPort=…&hcToken=…&hcAdminPort=…
[web]   member B  http://127.0.0.1:8880/?hcPort=…&hcToken=…&hcAdminPort=…
```

Member A is on `localhost` and member B on `127.0.0.1`: two origins to the browser, so their storage stays apart even in one profile. A third member or more shares `localhost`; open it in its own browser profile or private window. Ctrl-C stops everything and deletes the sandbox.

## What it starts

- A local `kitsune2-bootstrap-srv`, the only bootstrap the conductor knows, so the members find each other and nothing outside this machine joins.
- One `hc sandbox` conductor on the in-process (`mem`) transport, in `/tmp/rao-web-<admin port>`. Its `.hc` index is written there too, so the project root's `.hc` (used by `bun start` and the e2e suite) is left alone.
- The hApp installed once per member, as `requests_and_offers`, `requests_and_offers_b`, `requests_and_offers_c` and so on, each with its own agent key, all on one network seed that is new on every run.
- One Vite dev server for the UI.

The URL carries what `HolochainClientService` reads (`ui/src/lib/services/HolochainClientService.svelte.ts`): `hcPort` and `hcToken` to connect to the conductor's app interface, and `hcAdminPort` so a plain browser, which has no host signer, can get zome-call signing credentials.

## Ports

| Variable | Default | Used for |
| --- | --- | --- |
| `AGENTS` | 2 | members, from 1 to 26 |
| `UI_PORT` | 8880 | Vite |
| `ADMIN_PORT` | a free port | the conductor's admin interface, and the sandbox directory name |
| `BOOTSTRAP_PORT` | a free port | the local bootstrap server |

Two stacks can run side by side as long as their `UI_PORT` differ.

## Walking an exchange between two members

Found on the first two-member run (#419):

- **Reload after approval.** When the administrator accepts a member, that member's tab keeps the cached "pending" status until it reloads its own URL.
- **An offer before a Service Exchange proposal.** When the listing's medium is Service Exchange, the member who proposes must already have an offer of their own, or Send proposal stays disabled.

## Notes

- The launcher (`scripts/start-web.mts`) runs under Node, not Bun: `@holochain/client`'s `AdminWebsocket` handshake fails under Bun with "Expected 101" and succeeds under Node. Its pure parts are in `scripts/web-dev.mts`, tested by `bun test scripts/tests`.
- Data does not survive a restart: every run is a new sandbox and a new network seed. That is the point for development; use `bun start` or the desktop app to keep data.
- Set `WEB_VERBOSE=1` to see the conductor's log.
