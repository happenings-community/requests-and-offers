# edge-node/

Configuration and tooling for running an always-on edge node for Requests & Offers.

## Files

| File | Purpose |
|------|---------|
| `happ-config.json` | Config template for the Holo Edge Node container, for a hand-built install |
| `health-check.sh` | Checks container state, hApp installation, and peer connectivity |

Each release from `v0.6.0-alpha.2` attaches `edge-node-config.json`, this template filled in for that release: the hApp's URL and sha256, and the desktop testers' seed, bootstrap and relay. Prefer it to editing the template by hand:

```bash
gh release download vVERSION --repo happenings-community/requests-and-offers --pattern edge-node-config.json
install_happ edge-node-config.json
```

The release title ends in `(new network)` when its network differs from the previous release's; a node on the old network must reinstall from the new config.

## happ-config.json fields

- `app.version` — hApp version; update to match the release you installed (e.g. `"0.5.1"`)
- `app.modifiers.networkSeed` — the desktop network's seed for the release you install, named in its release notes (e.g. `"alpha2-holochain07-2026"`); `health-check.sh --manifest` fails a node on any other
- `env.holochain.bootstrapUrl` / `relayUrl` — the bootstrap and relay servers; Holochain 0.7 uses iroh only and ignores `signalServerUrl` and `stunServerUrls`:
  - **0.5.x dev-test network**: `https://dev-test-bootstrap2.holochain.org/`
  - **Production network**: `https://holostrap.elohim.host/`
- `env.holochain.version` — leave empty to use the version bundled with the Edge Node image
- `env.holochain.flags` / `stunServerUrls` — leave as empty arrays unless instructed otherwise

## Setup guide

See [documentation/guides/edge-node-setup.md](../documentation/guides/edge-node-setup.md) for full step-by-step instructions.
