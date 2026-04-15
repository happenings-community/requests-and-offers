#!/usr/bin/env bash
# health-check.sh — Quick health check for the Requests & Offers edge node
#
# Usage: ./health-check.sh [container-name]
#
# Checks that the edge node is running, the hApp is installed,
# and peers are connected on the network.

set -euo pipefail

CONTAINER="${1:-requests-and-offers-edgenode}"
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
if echo "$HAPP_STATUS" | grep -q '"type":"enabled"'; then
    VERSION=$(echo "$HAPP_STATUS" | grep -oP '"version":"[^"]*"' | head -1 | cut -d'"' -f4 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✓ hApp installed and enabled (v${VERSION})${NC}"
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

PEER_COUNT=$(echo "$STATS" | grep -oP '"pub_key"' | wc -l)
if [ "$PEER_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Connected to ${PEER_COUNT} peer(s)${NC}"

    # Show per-peer summary
    echo "$STATS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for conn in data.get('transport_stats', {}).get('connections', []):
    pk = conn['pub_key'][:12] + '...'
    sent = conn['send_message_count']
    recv = conn['recv_message_count']
    recv_mb = conn['recv_bytes'] / (1024 * 1024)
    print(f'  {pk}  sent:{sent}  recv:{recv}  ({recv_mb:.1f} MB received)')
" 2>/dev/null || true
else
    echo -e "${YELLOW}⚠ No peers connected${NC}"
    echo "  The node may still be discovering peers, or no other peers are online."
    echo "  Check logs: docker logs $CONTAINER --tail 50"
fi

echo "---"
echo -e "${BOLD}Done${NC}"
