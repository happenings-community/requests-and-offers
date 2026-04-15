# Running an Always-On Edge Node for Requests & Offers

An Edge Node is a dedicated, always-on peer that holds a copy of the DHT data and ensures other peers can sync even when no one else is online. This guide walks you through setting one up using the [Holo Edge Node](https://github.com/holo-host/edgenode) Docker container.

## Prerequisites

- A machine running Linux (dedicated or shared — a spare PC, NUC, server, or even a HomeStation)
- Docker installed and running
- Internet connection (the node needs to reach the bootstrap server)

## Step 1 — Pull and start the Edge Node container

```bash
docker pull ghcr.io/holo-host/edgenode

docker run --name requests-and-offers-edgenode -dit \
  -v $(pwd)/holo-data:/data \
  ghcr.io/holo-host/edgenode
```

## Step 2 — Download and unpack the hApp

On the **host machine** (not inside the container), download the latest release and extract the `.happ` file:

```bash
wget https://github.com/happenings-community/requests-and-offers/releases/download/v0.5.1/requests_and_offers.webhapp

hc web-app unpack requests_and_offers.webhapp -o ro-unpacked
```

Verify the file is intact:

```bash
file ro-unpacked/requests_and_offers.happ
# Should show: gzip compressed data
```

Copy it into the container:

```bash
docker cp ro-unpacked/requests_and_offers.happ \
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
    "version": "0.5.1",
    "happUrl": "file:///home/nonroot/requests_and_offers.happ",
    "modifiers": {
      "networkSeed": "Requests and Offers-0.5.x",
      "properties": ""
    }
  },
  "env": {
    "holochain": {
      "version": "",
      "flags": [""],
      "bootstrapUrl": "https://dev-test-bootstrap2.holochain.org/",
      "signalServerUrl": "wss://dev-test-bootstrap2.holochain.org/",
      "stunServerUrls": [""]
    }
  }
}
EOF
```

A pre-built version of this config is available at [`edge-node/happ-config.json`](edge-node/happ-config.json).

## Step 4 — Install and verify

```bash
install_happ /home/nonroot/ro_config.json
```

You should see output confirming the app was installed and enabled, with DNA hash `uhC0kiKzmAsFVJ_WyGlesnQX_UhuZdd02XOTHsqHpSAAj9HZFcUnN` for the `requests_and_offers` cell.

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

A convenience script is available at [`edge-node/health-check.sh`](edge-node/health-check.sh).

## Upgrading

When a new version is released:

1. Enter the container and uninstall the old version:
   ```bash
   docker exec -it requests-and-offers-edgenode su - nonroot
   list_happs  # copy the installed_app_id
   uninstall_happ "<installed_app_id>"
   ```

2. Download the new `.webhapp`, unpack, copy `.happ` into container (repeat Steps 2–4 with the new version number and network seed if changed)

## Troubleshooting

**No peers in `dump-network-stats`:**
- Check the container can reach the internet: `docker exec requests-and-offers-edgenode ping -c 1 dev-test-bootstrap2.holochain.org`
- Check the DNA hash matches what Moss reports (Settings → Group Tools → R&O → Show Advanced Settings)
- If the network seed has changed between versions, you'll need the new seed from Moss

**Container keeps restarting:**
- Check logs: `docker logs requests-and-offers-edgenode --tail 50`

**"Unsolicited Accept" errors in logs:**
- These are normal kitsune2 gossip behaviour during peer sync — not a problem.
