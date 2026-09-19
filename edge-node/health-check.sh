#!/usr/bin/env bash
# health-check.sh — Quick health check for the Requests & Offers edge node
#
# Usage: ./health-check.sh [container-name] [--manifest <release-manifest.json>]
#
# Checks that the edge node is running, the hApp is installed,
# and peers are connected on the network.
#
# With --manifest, it also checks the node is running the release it claims to.
# That check exists because a node left on a previous release keeps gossiping on
# a network nobody else is on and reports itself perfectly healthy: every check
# above passes, and the node is alone. Download the manifest from the release:
#
#   gh release download v0.6.0-alpha.2 --pattern release-manifest.json \
#     --repo happenings-community/requests-and-offers
#   ./health-check.sh --manifest release-manifest.json

set -euo pipefail

CONTAINER="requests-and-offers-edgenode"
MANIFEST=""
while [ $# -gt 0 ]; do
    case "$1" in
        --manifest) MANIFEST="${2:?--manifest needs a path}"; shift 2 ;;
        -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
        *) CONTAINER="$1"; shift ;;
    esac
done
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}Requests & Offers Edge Node Health Check${NC}"
echo "Container: $CONTAINER"
echo "---"

# Check container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo -e "${RED}✗ Container is not running${NC}"
    echo "  Start it with: docker start $CONTAINER"
    exit 1
fi
echo -e "${GREEN}✓ Container running${NC}"

# Check hApp is installed and enabled
HAPP_STATUS=$(docker exec "$CONTAINER" list_happs 2>/dev/null)
if echo "$HAPP_STATUS" | jq -e '[.[].status.type] | any(. == "enabled")' > /dev/null 2>&1; then
    VERSION=$(echo "$HAPP_STATUS" | jq -r '[.[] | select(.status.type == "enabled") | .installed_app_id][0] // "unknown"' 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✓ hApp installed and enabled (${VERSION})${NC}"
else
    echo -e "${RED}✗ hApp not installed or not enabled${NC}"
    echo "  Check with: docker exec -it $CONTAINER su - nonroot"
    echo "  Then run: list_happs"
    exit 1
fi

# Check network stats
STATS=$(docker exec "$CONTAINER" hc sandbox call -r 4444 dump-network-stats 2>/dev/null)
if [ -z "$STATS" ]; then
    echo -e "${RED}✗ Could not retrieve network stats${NC}"
    exit 1
fi

PEER_COUNT=$(echo "$STATS" | jq '.transport_stats.connections | length' 2>/dev/null || echo 0)
if [ "$PEER_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Connected to ${PEER_COUNT} peer(s)${NC}"

    # Show per-peer summary
    echo "$STATS" | jq -r '
      .transport_stats.connections[]? |
      "\(.pub_key[:12])...  sent:\(.send_message_count)  recv:\(.recv_message_count)  (\(.recv_bytes / 1048576 * 10 | round / 10) MB received)"
    ' 2>/dev/null || true
else
    echo -e "${YELLOW}⚠ No peers connected${NC}"
    echo "  The node may still be discovering peers, or no other peers are online."
    echo "  Check logs: docker logs $CONTAINER --tail 50"
fi


# Release verification. Only runs with --manifest, because without one there is
# nothing to compare against and a guess would be worse than silence.
if [ -n "$MANIFEST" ]; then
    echo "---"
    [ -r "$MANIFEST" ] || { echo -e "${RED}✗ Cannot read manifest: $MANIFEST${NC}"; exit 1; }

    WANT_VERSION=$(jq -r .version "$MANIFEST")
    WANT_HAPP_SHA=$(jq -r .happ.sha256 "$MANIFEST")
    WANT_SEED=$(jq -r .network.requestsAndOffersSeed "$MANIFEST")
    echo -e "${BOLD}Release ${WANT_VERSION}${NC}"

    # The hApp file the node installed from, read out of its own config rather
    # than assumed, falling back to the path the setup guide uses.
    HAPP_PATH=$(docker exec "$CONTAINER" sh -c \
        'cat /home/nonroot/ro_config.json 2>/dev/null || true' \
        | jq -r '.app.happUrl // empty' | sed 's#^file://##')
    [ -n "$HAPP_PATH" ] || HAPP_PATH=/home/nonroot/requests_and_offers.happ

    HAVE_HAPP_SHA=$(docker exec "$CONTAINER" sh -c "sha256sum '$HAPP_PATH' 2>/dev/null" | awk '{print $1}')
    if [ -z "$HAVE_HAPP_SHA" ]; then
        echo -e "${RED}✗ No hApp file at ${HAPP_PATH} to compare${NC}"
        exit 1
    elif [ "$HAVE_HAPP_SHA" = "$WANT_HAPP_SHA" ]; then
        echo -e "${GREEN}✓ hApp matches the release (${HAPP_PATH})${NC}"
    else
        echo -e "${RED}✗ hApp does NOT match release ${WANT_VERSION}${NC}"
        echo "  expected ${WANT_HAPP_SHA}"
        echo "  found    ${HAVE_HAPP_SHA}"
        echo "  This node is on a different build. Follow the Upgrading section of"
        echo "  documentation/guides/edge-node-setup.md."
        exit 1
    fi

    # The seed is reported, not asserted. The desktop wrapper overrides the
    # hApp's own seed at install time, so an edge node deliberately joining the
    # desktop network will differ from the manifest and still be correct. Only a
    # human knows which network this node is meant to be on.
    HAVE_SEED=$(docker exec "$CONTAINER" sh -c \
        'cat /home/nonroot/ro_config.json 2>/dev/null || true' \
        | jq -r '.app.modifiers.networkSeed // empty')
    if [ -z "$HAVE_SEED" ]; then
        echo -e "${YELLOW}⚠ Could not read this node's network seed${NC}"
    elif [ "$HAVE_SEED" = "$WANT_SEED" ]; then
        echo -e "${GREEN}✓ Network seed matches the hApp default (${HAVE_SEED})${NC}"
    else
        echo -e "${YELLOW}⚠ Network seed is '${HAVE_SEED}', the hApp default is '${WANT_SEED}'${NC}"
        echo "  Expected when this node joins the desktop app's network on purpose."
        echo "  Check it against the seed named in the release notes."
    fi
fi

echo "---"
echo -e "${BOLD}Done${NC}"
