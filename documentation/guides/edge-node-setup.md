# Running an Always-On Edge Node for Requests & Offers

An Edge Node is a dedicated, always-on peer that holds a copy of the DHT data and ensures other peers can sync even when no one else is online. This guide walks you through setting one up using the [Holo Edge Node](https://github.com/holo-host/edgenode) Docker container.

## Prerequisites

- A machine running Linux (dedicated or shared — a spare PC, NUC, server, or even a HomeStation)
- Docker installed and running
- Internet connection (the node needs to reach the bootstrap server)
- GitHub CLI (`gh`) installed, or `wget` for manual downloads

## Step 1 — Pull and start the Edge Node container

```bash
docker pull ghcr.io/holo-host/edgenode

docker run --name requests-and-offers-edgenode -dit \
  -v $(pwd)/holo-data:/data \
  ghcr.io/holo-host/edgenode
```

## Step 2 — Download the hApp

Download the latest `.happ` release asset directly — no Holochain CLI required:

```bash
gh release download \
  --repo happenings-community/requests-and-offers \
  --pattern "requests_and_offers.happ" \
  --dir .
```

Or with `wget` (replace the version with the [latest release](https://github.com/happenings-community/requests-and-offers/releases/latest)):

```bash
wget https://github.com/happenings-community/requests-and-offers/releases/latest/download/requests_and_offers.happ
```

Copy it into the container:

```bash
docker cp requests_and_offers.happ \
  requests-and-offers-edgenode:/home/nonroot/requests_and_offers.happ
```

## Step 3 — Create the hApp config

Enter the container:

```bash
docker exec -it requests-and-offers-edgenode su - nonroot
```

Create the config file:

```bash
cat > /home/nonroot/ro_config.json << 'EOF'
{
  "app": {
    "name": "requests-and-offers",
    "version": "<version>",
    "happUrl": "file:///home/nonroot/requests_and_offers.happ",
    "modifiers": {
      "networkSeed": "<network-seed>",
      "properties": ""
    }
  },
  "env": {
    "holochain": {
      "version": "",
      "flags": [],
      "bootstrapUrl": "https://dev-test-bootstrap2.holochain.org/",
      "signalServerUrl": "wss://dev-test-bootstrap2.holochain.org/",
      "stunServerUrls": []
    }
  }
}
EOF
```

> **Network note:** The bootstrap/signal URLs above are for the **0.5.x dev-test network**. For the production network, replace both URLs with `https://holostrap.elohim.host/` and `wss://holostrap.elohim.host/`.

A pre-built version of this config is available at [`edge-node/happ-config.json`](../../edge-node/happ-config.json). Both files use placeholders for `app.version` and `app.modifiers.networkSeed` — find the current values for the latest release in the [release notes](https://github.com/happenings-community/requests-and-offers/releases/latest).

## Step 4 — Install and verify

```bash
install_happ /home/nonroot/ro_config.json
```

You should see output confirming the app was installed and enabled. For v0.5.1, the DNA hash for the `requests_and_offers` cell is `uhC0kiKzmAsFVJ_WyGlesnQX_UhuZdd02XOTHsqHpSAAj9HZFcUnN` — this changes with each release, so cross-check against the release notes if you're on a different version.

Verify it's running:

```bash
list_happs
```

## Step 5 — Check network connectivity

Exit the container and run from the host:

```bash
docker exec requests-and-offers-edgenode \
  hc sandbox call -r 4444 dump-network-stats
```

You should see active connections with `send_message_count` and `recv_message_count` incrementing. This confirms your edge node is gossiping with peers on the network.

A convenience script is available at [`edge-node/health-check.sh`](../../edge-node/health-check.sh).

## Upgrading

When a new version is released:

1. Enter the container and uninstall the old version:
   ```bash
   docker exec -it requests-and-offers-edgenode su - nonroot
   list_happs  # copy the installed_app_id
   uninstall_happ "<installed_app_id>"
   ```

2. Download the new `.happ` and copy it into the container (repeat Steps 2–4 with the updated version number and network seed from the release notes).

## Troubleshooting

**No peers in `dump-network-stats`:**
- Check the container can reach the internet: `docker exec requests-and-offers-edgenode ping -c 1 dev-test-bootstrap2.holochain.org`
- Check the DNA hash matches what Moss reports (Settings → Group Tools → R&O → Show Advanced Settings)
- If the network seed has changed between versions, you'll need the new seed from the release notes

**Container keeps restarting:**
- Check logs: `docker logs requests-and-offers-edgenode --tail 50`

**"Unsolicited Accept" errors in logs:**
- These are normal kitsune2 gossip behaviour during peer sync — not a problem.
