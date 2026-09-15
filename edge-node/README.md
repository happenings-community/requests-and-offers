# edge-node/

Configuration and tooling for running an always-on edge node for Requests & Offers.

## Files

| File | Purpose |
|------|---------|
| `happ-config.json` | Config template for the Holo Edge Node container |
| `health-check.sh` | Checks container state, hApp installation, and peer connectivity |

## happ-config.json fields

- `app.version` — hApp version; update to match the release you installed (e.g. `"0.5.1"`)
- `app.modifiers.networkSeed` — must match the network seed for the target version (e.g. `"Requests and Offers-0.5.x"`)
- `env.holochain.bootstrapUrl` / `signalServerUrl` — the bootstrap and signal servers:
  - **0.5.x dev-test network**: `https://dev-test-bootstrap2.holochain.org/`
  - **Production network**: `https://holostrap.elohim.host/`
- `env.holochain.version` — leave empty to use the version bundled with the Edge Node image
- `env.holochain.flags` / `stunServerUrls` — leave as empty arrays unless instructed otherwise

## Setup guide

See [documentation/guides/edge-node-setup.md](../documentation/guides/edge-node-setup.md) for full step-by-step instructions.
